import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Satellite, Search, Settings, RefreshCw, Eye, Navigation, Clock, Target, Key } from 'lucide-react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Sphere, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { TextureLoader } from 'three';
import * as satellite from 'satellite.js';
import spaceTrackService from '../services/spaceTrackService';

//parse tle epoch from line 1 (format: YYDDd.dddddddd)
const parseTLEEpoch = (tle1) => {
  const epochStr = tle1.substring(18, 32).trim();
  const year = parseInt(epochStr.substring(0, 2));
  const fullYear = year < 57 ? 2000 + year : 1900 + year; //y2k pivot
  const dayOfYear = parseFloat(epochStr.substring(2));

  const epoch = new Date(fullYear, 0, 1);
  epoch.setDate(epoch.getDate() + dayOfYear - 1);

  return epoch;
};

//ground track calculation
const calculateGroundTrack = (satrec, startTime, durationMinutes, step = 1) => {
  const points = [];

  for (let i = 0; i < durationMinutes; i += step) {
    const time = new Date(startTime.getTime() + i * 60000);
    const posVel = satellite.propagate(satrec, time);

    //check for valid position with no errors
    if (posVel.position && !posVel.position.error) {
      const gmst = satellite.gstime(time);
      const geoPos = satellite.eciToGeodetic(posVel.position, gmst);

      const latitude = satellite.degreesLat(geoPos.latitude);
      const longitude = satellite.degreesLong(geoPos.longitude);
      const altitude = geoPos.height;

      //validate all values 
      if (isFinite(latitude) && isFinite(longitude) && isFinite(altitude)) {
        points.push({
          latitude,
          longitude,
          altitude,
          time: time
        });
      } else {
        console.warn(`Invalid ground track point at time ${time.toISOString()}: lat=${latitude}, lon=${longitude}, alt=${altitude}`);
      }
    }
  }

  return points;
};

//visibility calculation
const calculateVisibility = (satPos, observerLat, observerLon, observerAlt = 0) => {
  //validate input parameters
  if (!satPos || !isFinite(satPos.latitude) || !isFinite(satPos.longitude) || !isFinite(satPos.altitude)) {
    console.error('Invalid satellite position:', satPos);
    return { range: 0, elevation: -90, azimuth: 0, isVisible: false };
  }

  if (!isFinite(observerLat) || !isFinite(observerLon)) {
    console.error('Invalid observer position:', { observerLat, observerLon });
    return { range: 0, elevation: -90, azimuth: 0, isVisible: false };
  }

  //convert observer position to ecef
  const earthRadius = 6371;
  const obsLatRad = observerLat * Math.PI / 180;
  const obsLonRad = observerLon * Math.PI / 180;
  
  const obsX = (earthRadius + observerAlt / 1000) * Math.cos(obsLatRad) * Math.cos(obsLonRad);
  const obsY = (earthRadius + observerAlt / 1000) * Math.cos(obsLatRad) * Math.sin(obsLonRad);
  const obsZ = (earthRadius + observerAlt / 1000) * Math.sin(obsLatRad);
  
  //convert satellite position to ecef
  const satLatRad = satPos.latitude * Math.PI / 180;
  const satLonRad = satPos.longitude * Math.PI / 180;
  const satRadius = earthRadius + satPos.altitude;
  
  const satX = satRadius * Math.cos(satLatRad) * Math.cos(satLonRad);
  const satY = satRadius * Math.cos(satLatRad) * Math.sin(satLonRad);
  const satZ = satRadius * Math.sin(satLatRad);
  
  //calculate range vector
  const dx = satX - obsX;
  const dy = satY - obsY;
  const dz = satZ - obsZ;
  
  const range = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  //calculate elevation angle
  const rangeHorizontal = Math.sqrt(dx * dx + dy * dy);
  const elevation = Math.atan2(dz, rangeHorizontal) * 180 / Math.PI;
  
  //calculate azimuth
  const azimuth = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  
  //if satellite is above horizon
  const isVisible = elevation > 0;
  
  return {
    range,
    elevation,
    azimuth,
    isVisible
  };
};

//pass prediction
const predictPasses = (satrec, observerLat, observerLon, startTime, hours = 24, minElevation = 10) => {
  const passes = [];
  let inPass = false;
  let currentPass = null;

  //check every minute for specified duration
  for (let i = 0; i < hours * 60; i++) {
    const time = new Date(startTime.getTime() + i * 60000);
    const posVel = satellite.propagate(satrec, time);

    //check for valid position without errors
    if (posVel.position && !posVel.position.error) {
      const gmst = satellite.gstime(time);
      const geoPos = satellite.eciToGeodetic(posVel.position, gmst);

      const latitude = satellite.degreesLat(geoPos.latitude);
      const longitude = satellite.degreesLong(geoPos.longitude);
      const altitude = geoPos.height;

      //validate coordinates before using them
      if (!isFinite(latitude) || !isFinite(longitude) || !isFinite(altitude)) {
        continue; // skip if coordinates are invalid
      }

      const satPos = {
        latitude,
        longitude,
        altitude
      };

      const visibility = calculateVisibility(satPos, observerLat, observerLon);
      
      //detect pass start
      if (!inPass && visibility.elevation > minElevation) {
        inPass = true;
        currentPass = {
          startTime: time,
          maxElevation: visibility.elevation,
          maxElevationTime: time,
          startAzimuth: visibility.azimuth
        };
      }
      
      //update max elevation during pass
      if (inPass && visibility.elevation > currentPass.maxElevation) {
        currentPass.maxElevation = visibility.elevation;
        currentPass.maxElevationTime = time;
      }
      
      //detect pass end
      if (inPass && visibility.elevation < minElevation) {
        inPass = false;
        currentPass.endTime = time;
        currentPass.endAzimuth = visibility.azimuth;
        currentPass.duration = (currentPass.endTime - currentPass.startTime) / 60000; //minutes
        passes.push(currentPass);
        currentPass = null;
      }
    }
  }
  
  return passes;
};

//web worker simulation using satellite.js
class SatelliteWorker {
  constructor() {
    this.callbacks = new Map();
    this.messageId = 0;
  }

  postMessage(data) {
    const id = this.messageId++;

    setTimeout(() => {
      const { satellites, time } = data;
      const positions = satellites.map(sat => {
        try {
          //validate tle data before processing
          if (!sat.tle1 || !sat.tle2 || sat.tle1.length !== 69 || sat.tle2.length !== 69) {
            console.error(`Invalid TLE data for satellite ${sat.name}`);
            return null;
          }

          //parse tle using satellite.js
          const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);

          //check for parsing errors
          if (satrec.error) {
            console.error(`TLE parsing error for satellite ${sat.name}:`, satrec.error);
            return null;
          }

          //propagate to current time
          const positionAndVelocity = satellite.propagate(satrec, time);

          //error checking - check if positionAndVelocity exists first
          if (positionAndVelocity && positionAndVelocity.position && !positionAndVelocity.position.error) {
            const gmst = satellite.gstime(time);
            const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

            return {
              id: sat.id,
              name: sat.name,
              latitude: satellite.degreesLat(positionGd.latitude),
              longitude: satellite.degreesLong(positionGd.longitude),
              altitude: positionGd.height
            };
          } else if (!positionAndVelocity) {
            console.warn(`Propagation returned null for satellite ${sat.name} - likely decayed or invalid TLE`);
          }
        } catch (error) {
          console.error(`Error propagating satellite ${sat.name}:`, error);
        }
        return null;
      }).filter(Boolean);

      if (this.onmessage) {
        this.onmessage({ data: { positions } });
      }
    }, 0);
  }

  terminate() {
    this.onmessage = null;
  }
}

//help func to propagate satellite position
const propagateSatellite = (satrec, date) => {
  try {
    const positionAndVelocity = satellite.propagate(satrec, date);

    if (positionAndVelocity.position && !positionAndVelocity.position.error) {
      const gmst = satellite.gstime(date);
      const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

      return {
        latitude: satellite.degreesLat(positionGd.latitude),
        longitude: satellite.degreesLong(positionGd.longitude),
        altitude: positionGd.height,
      };
    }
  } catch (error) {
    console.error('Propagation error:', error);
  }
  return null;
};

//3d earth comp
const Earth = ({ observerLocation }) => {
  //load textures from nasa (blue marble)
  //replacable url (higher quality textures)
  const earthTexture = useLoader(
    TextureLoader,
    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg'
  );

  //optional bump/normal map for detail
  const earthBumpMap = useLoader(
    TextureLoader,
    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_normal_2048.jpg'
  );

  return (
    <group>
      {/*earth sphere - no rotation, adjust longitude instead*/}
      <Sphere args={[6.371, 64, 64]}>
        <meshStandardMaterial
          map={earthTexture}
          normalMap={earthBumpMap}
          normalScale={[0.5, 0.5]}
          roughness={0.7}
          metalness={0.1}
        />
      </Sphere>

      {/*atmosphere*/}
      <Sphere args={[6.5, 64, 64]}>
        <meshBasicMaterial
          color="#4dabf7"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </Sphere>

      {/*observer marker*/}
      {observerLocation && (
        <group>
          {(() => {
            //convert lat/lon to rads
            const latRad = observerLocation.lat * Math.PI / 180;
            //add 90 deg to lon to compensate for texture orientation
            const lonRad = (observerLocation.lon + 90) * Math.PI / 180;
            const radius = 6.371;

            //spherical to cartesian conversion
            const x = radius * Math.cos(latRad) * Math.sin(lonRad);
            const y = radius * Math.sin(latRad);
            const z = radius * Math.cos(latRad) * Math.cos(lonRad);

            return (
              <group>
                {/*main marker*/}
                <mesh position={[x, y, z]}>
                  <sphereGeometry args={[0.15, 32, 32]} />
                  <meshBasicMaterial color="#ff0000" />
                </mesh>

                {/*Outer glow*/}
                <mesh position={[x, y, z]}>
                  <sphereGeometry args={[0.25, 32, 32]} />
                  <meshBasicMaterial
                    color="#ff0000"
                    transparent
                    opacity={0.4}
                  />
                </mesh>

                {/*large pulsing ring*/}
                <mesh position={[x, y, z]}>
                  <sphereGeometry args={[0.35, 32, 32]} />
                  <meshBasicMaterial
                    color="#ff3333"
                    transparent
                    opacity={0.2}
                    side={THREE.DoubleSide}
                  />
                </mesh>

                {/*vertical line to center*/}
                <line>
                  <bufferGeometry>
                    {(() => {
                      const points = [
                        new THREE.Vector3(0, 0, 0),
                        new THREE.Vector3(x, y, z)
                      ];
                      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
                      return <primitive object={lineGeometry} attach="geometry" />;
                    })()}
                  </bufferGeometry>
                  <lineBasicMaterial color="#ff0000" opacity={0.3} transparent linewidth={2} />
                </line>
              </group>
            );
          })()}
        </group>
      )}
    </group>
  );
};

//3d satellite comp
const Satellite3D = ({ position, color, isSelected, name }) => {
  //validate position data
  if (!position ||
      !isFinite(position.latitude) ||
      !isFinite(position.longitude) ||
      !isFinite(position.altitude) ||
      Math.abs(position.latitude) > 90 ||
      Math.abs(position.longitude) > 180 ||
      position.altitude < 0) {
    console.warn(`Invalid position data for satellite ${name}:`, position);
    return null;
  }

  //convert geodetic coordinates to 3d position
  //earth radius: 6.371 = 6371 km in scene units
  //satellite alt is in km
  //example: iss at 420km alt -> radius = 6.371 + 0.420 = 6.791
  const latRad = position.latitude * Math.PI / 180;
  const lonRad = (position.longitude + 90) * Math.PI / 180; //add 90 degree offset for texture alignment
  const altitude = position.altitude; //in km
  const earthRadius = 6.371; //represents 6371 km
  const radius = earthRadius + (altitude / 1000); //convert km to thousands of km

  //spherical to cartesian conversion matching location marker
  const x = radius * Math.cos(latRad) * Math.sin(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * Math.cos(latRad) * Math.cos(lonRad);

  //cal surface point for alt line
  const surfaceRadius = earthRadius;
  const surfaceX = surfaceRadius * Math.cos(latRad) * Math.sin(lonRad);
  const surfaceY = surfaceRadius * Math.sin(latRad);
  const surfaceZ = surfaceRadius * Math.cos(latRad) * Math.cos(lonRad);

  return (
    <group position={[x, y, z]}>
      {/*main sat body*/}
      <mesh>
        <sphereGeometry args={[isSelected ? 0.1 : 0.06, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/*inner glow*/}
      <mesh>
        <sphereGeometry args={[isSelected ? 0.15 : 0.09, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/*outer glow ring*/}
      <mesh>
        <sphereGeometry args={[isSelected ? 0.2 : 0.12, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2}
        />
      </mesh>

      {/*alt line from surface to sat*/}
      <line>
        <bufferGeometry>
          {(() => {
            const points = [
              new THREE.Vector3(surfaceX - x, surfaceY - y, surfaceZ - z),
              new THREE.Vector3(0, 0, 0)
            ];
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            return <primitive object={lineGeometry} attach="geometry" />;
          })()}
        </bufferGeometry>
        <lineBasicMaterial color={color} opacity={0.3} transparent />
      </line>
    </group>
  );
};

//ground track comp
const GroundTrack3D = ({ groundTrack, color }) => {
  if (!groundTrack || groundTrack.length < 2) return null;

  //filter and validate ground track points prior to rendering
  const points = groundTrack
    .filter(point => {
      //validate all fields exist and are valid 
      return point &&
             isFinite(point.latitude) &&
             isFinite(point.longitude) &&
             isFinite(point.altitude) &&
             Math.abs(point.latitude) <= 90 &&
             Math.abs(point.longitude) <= 180 &&
             point.altitude >= 0;
    })
    .map(point => {
      const latRad = point.latitude * Math.PI / 180;
      const lonRad = (point.longitude + 90) * Math.PI / 180; //add 90 deg offset, texture alignment
      const radius = 6.371 + point.altitude / 1000;

      //spherical to cartesian conversion matching location marker
      const x = radius * Math.cos(latRad) * Math.sin(lonRad);
      const y = radius * Math.sin(latRad);
      const z = radius * Math.cos(latRad) * Math.cos(lonRad);

      return new THREE.Vector3(x, y, z);
    });

  //skip render if not enough valid points after filtering
  if (points.length < 2) return null;

  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <line>
      <primitive object={lineGeometry} attach="geometry" />
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
};

//3d scene comp
const Scene3D = ({ positions, satellites, selectedSatellite, observerLocation, groundTrack, getCategoryColor }) => {
  return (
    <>
      <ambientLight intensity={1.2} />
      <pointLight position={[100, 100, 100]} intensity={1.5} />
      <pointLight position={[-100, -100, -100]} intensity={0.5} />

      <Stars radius={300} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <Earth observerLocation={observerLocation} />

      {/*ground track for selected sat*/}
      {selectedSatellite && groundTrack && groundTrack.length > 0 && (
        <GroundTrack3D
          groundTrack={groundTrack}
          color={getCategoryColor(selectedSatellite.category)}
        />
      )}

      {/*sats*/}
      {Object.values(positions).map(pos => {
        const sat = satellites.find(s => s.id === pos.id);
        if (!sat) return null;

        return (
          <Satellite3D
            key={pos.id}
            position={pos}
            color={getCategoryColor(sat.category)}
            isSelected={selectedSatellite?.id === pos.id}
            name={sat.name}
          />
        );
      })}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={10}
        maxDistance={100}
      />
    </>
  );
};

const SatelliteTracker = () => {
  const [satellites, setSatellites] = useState([]);
  const [selectedSatellite, setSelectedSatellite] = useState(null);
  const [positions, setPositions] = useState({});
  const [isTracking, setIsTracking] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [updateInterval, setUpdateInterval] = useState(1000);
  const [lastTleUpdate, setLastTleUpdate] = useState(new Date());
  const [observerLocation, setObserverLocation] = useState(null); //skip def location
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
  const [groundTrack, setGroundTrack] = useState([]);
  const [visibility, setVisibility] = useState(null);
  const [upcomingPasses, setUpcomingPasses] = useState([]);
  const [showGroundTrack, setShowGroundTrack] = useState(true);
  const [showVisibilityCircle, setShowVisibilityCircle] = useState(true);
  const [activeTab, setActiveTab] = useState('tracking'); //tracking, passes, visibility
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('popular'); //popular, category, all
  const [selectedCategory, setSelectedCategory] = useState('starlink');
  const workerRef = useRef(null);
  const mapRef = useRef(null);
  const animationRef = useRef(null);

  //auth handler
  const handleAuthentication = async () => {
    setIsLoading(true);
    setError(null);

    try {
      spaceTrackService.setCredentials(username, password);
      await spaceTrackService.login();
      setIsAuthenticated(true);
      setShowAuthDialog(false);

      //save credentials to localStorage, NOT SAFE FOR PROD YET
      localStorage.setItem('spacetrack_username', username);
      localStorage.setItem('spacetrack_password', password);

      //Load sats after auth
      await loadSatellites();
    } catch (error) {
      setError('Authentication failed. Please check your credentials.');
      console.error('Authentication error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  //load sats from spacetrack
  const loadSatellites = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let satelliteData;

      switch(dataSource) {
        case 'popular':
          satelliteData = await spaceTrackService.getPopularSatellites();
          break;
        case 'category':
          satelliteData = await spaceTrackService.getTLEsByCategory(selectedCategory, 50);
          break;
        case 'all':
          satelliteData = await spaceTrackService.getAllActiveTLEs(100);
          break;
        default:
          satelliteData = await spaceTrackService.getPopularSatellites();
      }

      //filter out sats with invalid tle data
      const validSatellites = satelliteData.filter(sat => {
        if (!sat.tle1 || !sat.tle2 || sat.tle1.length !== 69 || sat.tle2.length !== 69) {  //chk for null/invalid tle
          console.warn(`Invalid TLE data for satellite ${sat.name}, skipping.`);
          return false;
        }
        //check tle age
        try {
          const tleEpoch = parseTLEEpoch(sat.tle1);
          const tleAgeDays = (new Date() - tleEpoch) / (1000 * 60 * 60 * 24);
          if (tleAgeDays > 60) {
            console.warn('TLE for satellite', sat.name, 'is over 60 days old, skipping.');
            return false;
          }
        } catch (error) {
          console.error(`Error parsing TLE for satellite ${sat.name}:`, error);
          return false;
        }
        //tle parse test
        try {
          const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
          if (satrec.error) {
            console.warn(`TLE parsing error for satellite ${sat.name}:`, satrec.error);
            return false;
          }
        //propagation test
        const testPos = satellite.propagate(satrec, new Date());
        if (!testPos || !testPos.position || testPos.position.error) {
          console.warn(`Propagation error for satellite ${sat.name}, skipping.`);
          return false;
        }
        } catch (error) {
          console.error(`Error propagating satellite ${sat.name}:`, error);
          return false;
        }
        return true;
      });

      console.log(`loaded ${validSatellites.length}/${satelliteData.length} sats (filtered ${satelliteData.length - validSatellites.length} invalid tles)`);

      setSatellites(validSatellites);
      setLastTleUpdate(new Date());
    } catch (error) {
      setError('Failed to load satellite data. Please check your connection and try again.');
      console.error('Load satellites error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  //check for env vars or saved creds on mount
  useEffect(() => {
    //check for env vars
    const envUsername = import.meta.env.VITE_SPACETRACK_USERNAME;
    const envPassword = import.meta.env.VITE_SPACETRACK_PASSWORD;

    //are env vars set, not placeholder values
    if (envUsername && envPassword &&
        envUsername !== 'your_username_here' &&
        envPassword !== 'your_password_here') {
      setUsername(envUsername);
      setPassword(envPassword);
      spaceTrackService.setCredentials(envUsername, envPassword);

      //try auto auth with env vars
      spaceTrackService.login()
        .then(() => {
          setIsAuthenticated(true);
          loadSatellites();
        })
        .catch((error) => {
          console.error('Auto-authentication with env variables failed:', error);
          setShowAuthDialog(true);
        });
      return;
    }

    //if no env vars, check localStorage
    const savedUsername = localStorage.getItem('spacetrack_username');
    const savedPassword = localStorage.getItem('spacetrack_password');

    if (savedUsername && savedPassword) {
      setUsername(savedUsername);
      setPassword(savedPassword);
      spaceTrackService.setCredentials(savedUsername, savedPassword);

      //auto auth
      spaceTrackService.login()
        .then(() => {
          setIsAuthenticated(true);
          loadSatellites();
        })
        .catch(() => {
          setShowAuthDialog(true);
        });
    } else {
      setShowAuthDialog(true);
    }
  }, []);

  //reload sats when data source or category changes
  useEffect(() => {
    if (isAuthenticated) {
      loadSatellites();
    }
  }, [dataSource, selectedCategory]);

  useEffect(() => {
    workerRef.current = new SatelliteWorker();
    
    workerRef.current.onmessage = (e) => {
      const { positions: newPositions } = e.data;
      const posMap = {};
      newPositions.forEach(pos => {
        posMap[pos.id] = pos;
      });
      setPositions(posMap);
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  useEffect(() => {
    if (!isTracking || satellites.length === 0) return;

    const updatePositions = () => {
      if (workerRef.current) {
        workerRef.current.postMessage({
          satellites: satellites,
          time: new Date()
        });
      }
      
      animationRef.current = setTimeout(updatePositions, updateInterval);
    };

    updatePositions();

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isTracking, satellites, updateInterval]);

  //cal selected sat ground track
  useEffect(() => {
    if (!selectedSatellite || !showGroundTrack) {
      setGroundTrack([]);
      return;
    }

    const updateGroundTrack = () => {
      try {
        //validate tle data prior to processing
        if (!selectedSatellite.tle1 || !selectedSatellite.tle2) {
          console.error('Invalid TLE data for satellite:', selectedSatellite.name);
          setGroundTrack([]);
          return;
        }
        const satrec = satellite.twoline2satrec(selectedSatellite.tle1, selectedSatellite.tle2);
        if (satrec.error) {
          console.error('TLE parsing error for satellite:', selectedSatellite.name, satrec.error);
          setGroundTrack([]);
          return;
        }

        //calc path from current time (updates as sat moves)
        const track = calculateGroundTrack(satrec, new Date(), 180, 2); //3 hour, 2 min steps

        //chk tle age and warn if too old
        const tleEpoch = parseTLEEpoch(selectedSatellite.tle1);
        const tleAgeHours = (new Date() - tleEpoch) / (1000 * 60 * 60);
        const tleAgeDays = Math.floor(tleAgeHours / 24);

        if (tleAgeDays > 30) {
          console.warn(`${selectedSatellite.name} tle is ${tleAgeDays} days old! ground track may b inaccurate.`);
          console.warn('click "refresh tles" to get updated orbital data.');
        }

        //debug logging for problematic sats
        if (selectedSatellite.name.includes('SMOG') || tleAgeDays > 30) {
          console.log(`${selectedSatellite.name} debug info:`);
          console.log('tle line 1:', selectedSatellite.tle1);
          console.log('tle line 2:', selectedSatellite.tle2);
          console.log('tle epoch:', tleEpoch.toISOString());
          console.log('tle age:', `${tleAgeDays} days (${tleAgeHours.toFixed(0)} hrs)`);
          console.log('ground track pts:', track.length);

          //chk for longitude discontinuities
          let maxJump = 0;
          let jumpCount = 0;
          for (let i = 1; i < track.length; i++) {
            const jump = Math.abs(track[i].longitude - track[i-1].longitude);
            if (jump > maxJump) maxJump = jump;
            if (jump > 180) jumpCount++;
          }
          console.log('max lon jump:', maxJump.toFixed(1), 'deg');
          console.log('dateline crossings:', jumpCount);

          if (maxJump > 300) {
            console.error('extreme lon jumps detected! tle data likely too old or corrupt.');
          }

          //sample first 10 pts
          console.log('first 10 pts:', track.slice(0, 10).map(p => ({
            lat: p.latitude.toFixed(2),
            lon: p.longitude.toFixed(2),
            alt: p.altitude.toFixed(0)
          })));
        }

        setGroundTrack(track);
      } catch (error) {
        console.error('Error calculating ground track:', error);
        setGroundTrack([]);
      }
    };

    //calc immediately
    updateGroundTrack();

    //recalc every 30 sec to keep path synced w/ sat position
    const groundTrackInterval = setInterval(updateGroundTrack, 5000);

    return () => {
      clearInterval(groundTrackInterval);
    };
  }, [selectedSatellite, showGroundTrack]);

  //cal visibility of selected sat
  useEffect(() => {
    if (selectedSatellite && positions[selectedSatellite.id] && observerLocation) {
      const satPos = positions[selectedSatellite.id];
      const vis = calculateVisibility(satPos, observerLocation.lat, observerLocation.lon);
      setVisibility(vis);
    } else {
      setVisibility(null);
    }
  }, [selectedSatellite, positions, observerLocation]);

  //cal selected sat pass predictions
  useEffect(() => {
    if (selectedSatellite && observerLocation) {
      try {
        //val tle data before processing
        if (!selectedSatellite.tle1 || !selectedSatellite.tle2) {
          console.error('Invalid TLE data for satellite:', selectedSatellite.name);
          setUpcomingPasses([]);
          return;
        }
        const satrec = satellite.twoline2satrec(selectedSatellite.tle1, selectedSatellite.tle2);
        if (satrec.error) {
          console.error('TLE parsing error for satellite:', selectedSatellite.name, satrec.error);
          setUpcomingPasses([]);
          return;
        }
        const passes = predictPasses(satrec, observerLocation.lat, observerLocation.lon, new Date(), 24, 10);
        setUpcomingPasses(passes);
      } catch (error) {
        console.error('Error calculating pass predictions:', error);
        setUpcomingPasses([]);
      }
    } else {
      setUpcomingPasses([]);
    }
  }, [selectedSatellite, observerLocation]);

  const refreshTles = async () => {
    if (isAuthenticated) {
      await loadSatellites();
    }
  };

  //retrieve users location, browser geolocation
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      setShowLocationPrompt(false);
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setObserverLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          name: `Your Location (${position.coords.latitude.toFixed(4)}°, ${position.coords.longitude.toFixed(4)}°)`
        });
        setGettingLocation(false);
        setShowLocationPrompt(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. You can set it manually later in the Passes or Visibility tabs.');
        setGettingLocation(false);
        setShowLocationPrompt(false);
      }
    );
  };

  const skipLocationSetup = () => {
    setShowLocationPrompt(false);
  };

  useEffect(() => {
    const checkTleAge = setInterval(() => {
      const hoursSinceUpdate = (new Date() - lastTleUpdate) / (1000 * 60 * 60);
      if (hoursSinceUpdate > 24 && isAuthenticated) {
        refreshTles();
      }
    }, 3600000);

    return () => clearInterval(checkTleAge);
  }, [lastTleUpdate, isAuthenticated]);

  const filteredSatellites = satellites.filter(sat =>
    sat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getOrbitType = (altitude) => {
    if (altitude < 2000) return 'LEO';
    if (altitude < 35786) return 'MEO';
    return 'GEO';
  };

  const getCategoryColor = (category) => {
    const colors = {
      station: '#00ff00',
      starlink: '#00bfff',
      weather: '#ffa500',
      communication: '#ff1493',
      navigation: '#9370db',
      other: '#00ffff' //choose high vis color
    };
    return colors[category] || '#00ffff';
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="h-screen w-full bg-gray-900 text-white flex flex-col overflow-hidden">
      {/*auth dialog*/}
      {showAuthDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <Key className="text-blue-400" size={24} />
              <h2 className="text-xl font-bold">Space-Track.org Login</h2>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              To access real satellite data, please sign in with your Space-Track.org credentials.
              Don't have an account? <a href="https://www.space-track.org/auth/createAccount" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Create one for free</a>
            </p>

            {error && (
              <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-2 rounded mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none"
                  placeholder="Enter your Space-Track username"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none"
                  placeholder="Enter your Space-Track password"
                  disabled={isLoading}
                  onKeyPress={(e) => e.key === 'Enter' && handleAuthentication()}
                />
              </div>

              <button
                onClick={handleAuthentication}
                disabled={isLoading || !username || !password}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Key size={16} />
                    Sign In
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 text-xs text-gray-400">
              <p>Note: Your credentials are stored locally in your browser for convenience.</p>
              <p className="mt-2">
                Tip: You can also set <code className="bg-gray-700 px-1 rounded">VITE_SPACETRACK_USERNAME</code> and{' '}
                <code className="bg-gray-700 px-1 rounded">VITE_SPACETRACK_PASSWORD</code> in a <code className="bg-gray-700 px-1 rounded">.env</code> file to skip this dialog.
              </p>
            </div>
          </div>
        </div>
      )}

      {/*location prompt dialog*/}
      {showLocationPrompt && !showAuthDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="text-blue-400" size={24} />
              <h2 className="text-xl font-bold">Set Your Location</h2>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              To see satellite visibility, pass predictions, and accurate tracking from your location, please share your GPS coordinates.
            </p>

            <div className="bg-blue-900 border border-blue-600 text-blue-200 px-4 py-3 rounded mb-4 text-sm">
              <p className="font-semibold mb-1">Why do we need your location?</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Calculate when satellites pass over YOUR location</li>
                <li>Show elevation and azimuth angles for viewing</li>
                <li>Display a red marker showing where YOU are on Earth</li>
              </ul>
            </div>

            <div className="space-y-3">
              <button
                onClick={getUserLocation}
                disabled={gettingLocation}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium flex items-center justify-center gap-2"
              >
                {gettingLocation ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Getting Location...
                  </>
                ) : (
                  <>
                    <MapPin size={16} />
                    Share My Location
                  </>
                )}
              </button>

              <button
                onClick={skipLocationSetup}
                disabled={gettingLocation}
                className="w-full py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm"
              >
                Skip for Now
              </button>
            </div>

            <div className="mt-4 text-xs text-gray-400">
              <p>You can always set your location later in the Passes or Visibility tabs.</p>
            </div>
          </div>
        </div>
      )}

      {/*header*/}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Satellite className="text-blue-400" size={28} />
          <div>
            <h1 className="text-xl font-bold">Satellite Tracker</h1>
            <p className="text-xs text-gray-400">
              {isAuthenticated ? (
                <>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Connected to Space-Track.org
                  </span>
                  {' • '}
                  Tracking {satellites.length} satellites
                  {' • '}
                  Updated {lastTleUpdate.toLocaleTimeString()}
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                    Not connected - Click Settings to login
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={refreshTles}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh TLEs
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2"
          >
            <Settings size={16} />
            Settings
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden w-full">
        {/*sidebar*/}
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
          {/*tabs*/}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('tracking')}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                activeTab === 'tracking' ? 'bg-gray-700 text-blue-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Target size={16} />
              Tracking
            </button>
            <button
              onClick={() => setActiveTab('passes')}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                activeTab === 'passes' ? 'bg-gray-700 text-blue-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Clock size={16} />
              Passes
            </button>
            <button
              onClick={() => setActiveTab('visibility')}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                activeTab === 'visibility' ? 'bg-gray-700 text-blue-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Eye size={16} />
              Visibility
            </button>
          </div>

          {/*tracking tab*/}
          {activeTab === 'tracking' && (
            <>
              <div className="p-4 border-b border-gray-700">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search satellites..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {isLoading && (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-center">
                      <RefreshCw size={32} className="animate-spin mx-auto mb-2 text-blue-400" />
                      <p className="text-sm text-gray-400">Loading satellites...</p>
                    </div>
                  </div>
                )}

                {!isLoading && filteredSatellites.length === 0 && (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-center text-gray-400">
                      <Satellite size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No satellites found</p>
                    </div>
                  </div>
                )}

                {!isLoading && filteredSatellites.map(sat => {
                  const pos = positions[sat.id];
                  return (
                    <div
                      key={sat.id}
                      onClick={() => setSelectedSatellite(sat)}
                      className={`p-3 border-b border-gray-700 cursor-pointer hover:bg-gray-700 ${
                        selectedSatellite?.id === sat.id ? 'bg-gray-700' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: getCategoryColor(sat.category) }}
                            />
                            {sat.name}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            NORAD ID: {sat.id}
                          </div>
                          {pos && (
                            <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                              <div>Lat: {pos.latitude.toFixed(4)}°</div>
                              <div>Lon: {pos.longitude.toFixed(4)}°</div>
                              <div>Alt: {pos.altitude.toFixed(1)} km ({getOrbitType(pos.altitude)})</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/*passes tab*/}
          {activeTab === 'passes' && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-blue-400" />
                    <span className="text-sm font-semibold">Observer Location</span>
                  </div>
                  <button
                    onClick={getUserLocation}
                    disabled={gettingLocation}
                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded flex items-center gap-1"
                    title="Get your actual location"
                  >
                    {gettingLocation ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        Getting...
                      </>
                    ) : (
                      <>
                        <MapPin size={12} />
                        {observerLocation ? 'Update Location' : 'Set My Location'}
                      </>
                    )}
                  </button>
                </div>
                {observerLocation ? (
                  <div className="text-xs text-gray-400 space-y-1">
                    <div>{observerLocation.name}</div>
                    <div>Lat: {observerLocation.lat.toFixed(4)}°</div>
                    <div>Lon: {observerLocation.lon.toFixed(4)}°</div>
                  </div>
                ) : (
                  <div className="text-xs text-yellow-400 bg-yellow-900 bg-opacity-20 border border-yellow-600 rounded p-2 mt-2">
                    <p>No location set. Click "Set My Location" to enable pass predictions.</p>
                  </div>
                )}
              </div>

              {selectedSatellite ? (
                <>
                  <div className="p-4 border-b border-gray-700 bg-gray-750">
                    <div className="font-semibold mb-2">{selectedSatellite.name}</div>
                    <div className="text-xs text-gray-400">
                      {upcomingPasses.length} passes in next 24 hours
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {upcomingPasses.map((pass, idx) => (
                      <div key={idx} className="p-4 border-b border-gray-700 hover:bg-gray-750">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-green-400" />
                            <span className="font-semibold text-sm">Pass #{idx + 1}</span>
                          </div>
                          <div className="text-xs px-2 py-1 bg-blue-600 rounded">
                            {pass.maxElevation.toFixed(1)}° max
                          </div>
                        </div>
                        
                        <div className="space-y-1 text-xs text-gray-400">
                          <div className="flex justify-between">
                            <span>Start:</span>
                            <span className="text-white">{pass.startTime.toLocaleTimeString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>End:</span>
                            <span className="text-white">{pass.endTime.toLocaleTimeString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Duration:</span>
                            <span className="text-white">{formatDuration(pass.duration)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Start Az:</span>
                            <span className="text-white">{pass.startAzimuth.toFixed(1)}°</span>
                          </div>
                          <div className="flex justify-between">
                            <span>End Az:</span>
                            <span className="text-white">{pass.endAzimuth.toFixed(1)}°</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {upcomingPasses.length === 0 && (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        <Navigation size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No passes above 10° elevation</p>
                        <p className="text-xs mt-1">in the next 24 hours</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-400 text-sm p-8">
                    <Target size={32} className="mx-auto mb-2 opacity-50" />
                    <p>Select a satellite to see</p>
                    <p>upcoming passes</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/*visibility tab*/}
          {activeTab === 'visibility' && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-blue-400" />
                    <span className="text-sm font-semibold">Observer Location</span>
                  </div>
                  <button
                    onClick={getUserLocation}
                    disabled={gettingLocation}
                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded flex items-center gap-1"
                    title="Get your actual location"
                  >
                    {gettingLocation ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        Getting...
                      </>
                    ) : (
                      <>
                        <MapPin size={12} />
                        {observerLocation ? 'Update Location' : 'Set My Location'}
                      </>
                    )}
                  </button>
                </div>
                {observerLocation ? (
                  <div className="text-xs text-gray-400 space-y-1">
                    <div>{observerLocation.name}</div>
                    <div>Lat: {observerLocation.lat.toFixed(4)}°</div>
                    <div>Lon: {observerLocation.lon.toFixed(4)}°</div>
                  </div>
                ) : (
                  <div className="text-xs text-yellow-400 bg-yellow-900 bg-opacity-20 border border-yellow-600 rounded p-2 mt-2">
                    <p>No location set. Click "Set My Location" to see visibility information.</p>
                  </div>
                )}
              </div>

              {selectedSatellite && visibility ? (
                <div className="p-4">
                  <div className="font-semibold mb-4">{selectedSatellite.name}</div>
                  
                  <div className={`p-4 rounded-lg mb-4 ${visibility.isVisible ? 'bg-green-900 border border-green-600' : 'bg-red-900 border border-red-600'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Eye size={16} />
                      <span className="font-semibold">
                        {visibility.isVisible ? 'Currently Visible' : 'Below Horizon'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-gray-400 mb-2">Elevation Angle</div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              visibility.elevation > 0 ? 'bg-green-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.max(0, Math.min(100, (visibility.elevation + 90) / 180 * 100))}%` }}
                          />
                        </div>
                        <span className="font-bold text-lg w-16 text-right">
                          {visibility.elevation.toFixed(1)}°
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {visibility.elevation < 0 ? 'Below horizon' : 
                         visibility.elevation < 10 ? 'Very low - poor visibility' :
                         visibility.elevation < 30 ? 'Low - fair visibility' :
                         visibility.elevation < 60 ? 'Good visibility' : 'Excellent visibility'}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-400 mb-2">Azimuth</div>
                      <div className="flex items-center justify-between">
                        <div className="relative w-32 h-32 mx-auto">
                          {/*compass*/}
                          <div className="absolute inset-0 border-2 border-gray-600 rounded-full" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-xs text-gray-400">
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2">N</div>
                              <div className="absolute -right-6 top-1/2 -translate-y-1/2">E</div>
                              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">S</div>
                              <div className="absolute -left-6 top-1/2 -translate-y-1/2">W</div>
                            </div>
                          </div>
                          {/*direction pointer*/}
                          <div
                            className="absolute top-1/2 left-1/2 w-1 h-12 bg-blue-500 origin-bottom transition-transform"
                            style={{
                              transform: `translate(-50%, -100%) rotate(${visibility.azimuth}deg)`
                            }}
                          >
                            <div className="w-3 h-3 bg-blue-500 rounded-full absolute -top-1 left-1/2 -translate-x-1/2" />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-2xl">{visibility.azimuth.toFixed(1)}°</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {visibility.azimuth >= 337.5 || visibility.azimuth < 22.5 ? 'North' :
                             visibility.azimuth < 67.5 ? 'Northeast' :
                             visibility.azimuth < 112.5 ? 'East' :
                             visibility.azimuth < 157.5 ? 'Southeast' :
                             visibility.azimuth < 202.5 ? 'South' :
                             visibility.azimuth < 247.5 ? 'Southwest' :
                             visibility.azimuth < 292.5 ? 'West' : 'Northwest'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-400 mb-2">Range</div>
                      <div className="font-bold text-xl">{visibility.range.toFixed(1)} km</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Distance from observer
                      </div>
                    </div>

                    {upcomingPasses.length > 0 && (
                      <div className="border-t border-gray-700 pt-4">
                        <div className="text-sm text-gray-400 mb-2">Next Pass</div>
                        <div className="bg-gray-750 p-3 rounded">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">Start:</span>
                            <span>{upcomingPasses[0].startTime.toLocaleTimeString()}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">Max Elevation:</span>
                            <span className="text-green-400 font-semibold">
                              {upcomingPasses[0].maxElevation.toFixed(1)}°
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Duration:</span>
                            <span>{formatDuration(upcomingPasses[0].duration)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-400 text-sm p-8">
                    <Eye size={32} className="mx-auto mb-2 opacity-50" />
                    <p>Select a satellite to see</p>
                    <p>visibility information</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/*3d view*/}
        <div className="flex-1 relative bg-black min-w-0 overflow-hidden">
          <Canvas
            camera={{ position: [15, 15, 15], fov: 60 }}
            style={{ width: '100%', height: '100%' }}
          >
            <Scene3D
              positions={positions}
              satellites={satellites}
              selectedSatellite={selectedSatellite}
              observerLocation={observerLocation}
              groundTrack={showGroundTrack ? groundTrack : []}
              getCategoryColor={getCategoryColor}
            />
          </Canvas>

          {/*controls*/}
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 rounded p-3 text-xs text-gray-300">
            <div className="font-semibold mb-1">3D Controls</div>
            <div>Left Click + Drag: Rotate</div>
            <div>Right Click + Drag: Pan</div>
            <div>Scroll: Zoom</div>
          </div>

          {/*selected sat info*/}
          {selectedSatellite && positions[selectedSatellite.id] && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 rounded-lg p-4 min-w-96">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg">{selectedSatellite.name}</h3>
                <button
                  onClick={() => setSelectedSatellite(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-400">Position</div>
                  <div>{positions[selectedSatellite.id].latitude.toFixed(4)}° N</div>
                  <div>{positions[selectedSatellite.id].longitude.toFixed(4)}° E</div>
                </div>
                <div>
                  <div className="text-gray-400">Altitude</div>
                  <div>{positions[selectedSatellite.id].altitude.toFixed(2)} km</div>
                  <div className="text-gray-400">
                    {getOrbitType(positions[selectedSatellite.id].altitude)} Orbit
                  </div>
                </div>
                {visibility && (
                  <>
                    <div>
                      <div className="text-gray-400">Elevation</div>
                      <div className={visibility.isVisible ? 'text-green-400' : 'text-red-400'}>
                        {visibility.elevation.toFixed(1)}°
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Azimuth</div>
                      <div>{visibility.azimuth.toFixed(1)}°</div>
                    </div>
                  </>
                )}
              </div>
              {upcomingPasses.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700 text-xs">
                  <div className="text-gray-400">Next pass in {Math.round((upcomingPasses[0].startTime - new Date()) / 60000)} minutes</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/*right sidebar, settings or system status*/}
        <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col overflow-y-auto flex-shrink-0">
          <div className="p-4">
            {showSettings ? (
              <>
                {/*settings panel*/}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Settings size={16} className="text-blue-400" />
                    <h3 className="font-semibold text-sm">Settings</h3>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  {/*data source settings*/}
                  <div>
                    <h3 className="font-semibold mb-3 text-sm">Data Source</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-2 block">Select Data Source</label>
                        <select
                          value={dataSource}
                          onChange={(e) => setDataSource(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none text-sm"
                        >
                          <option value="popular">Popular Satellites (ISS, HST, etc.)</option>
                          <option value="category">By Category</option>
                          <option value="all">All Active Satellites (100)</option>
                        </select>
                      </div>

                      {dataSource === 'category' && (
                        <div>
                          <label className="text-xs text-gray-400 mb-2 block">Category</label>
                          <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none text-sm"
                          >
                            <option value="station">Space Stations</option>
                            <option value="starlink">Starlink</option>
                            <option value="weather">Weather Satellites</option>
                            <option value="navigation">Navigation (GPS, etc.)</option>
                          </select>
                        </div>
                      )}

                      {isAuthenticated && (
                        <button
                          onClick={() => setShowAuthDialog(true)}
                          className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center justify-center gap-2"
                        >
                          <Key size={14} />
                          Change Login
                        </button>
                      )}
                    </div>
                  </div>

                  {/*performance settings*/}
                  <div className="pt-3 border-t border-gray-700">
                    <h3 className="font-semibold mb-3 text-sm">Performance Settings</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-2">Update Interval (ms)</label>
                        <input
                          type="range"
                          min="500"
                          max="5000"
                          step="500"
                          value={updateInterval}
                          onChange={(e) => setUpdateInterval(Number(e.target.value))}
                          className="w-full"
                        />
                        <div className="text-xs text-gray-400 mt-1">{updateInterval}ms</div>
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={showGroundTrack}
                            onChange={(e) => setShowGroundTrack(e.target.checked)}
                            className="rounded"
                          />
                          Show Ground Track
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={showVisibilityCircle}
                            onChange={(e) => setShowVisibilityCircle(e.target.checked)}
                            className="rounded"
                          />
                          Show Visibility Circle
                        </label>
                      </div>
                      <button
                        onClick={() => setIsTracking(!isTracking)}
                        className={`w-full py-2 rounded font-medium ${isTracking ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                      >
                        {isTracking ? 'Tracking Active' : 'Tracking Paused'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/*system status panel*/}
                <div className="flex items-center gap-2 mb-4">
                  <Settings size={16} className="text-blue-400" />
                  <h3 className="font-semibold text-sm">System Status</h3>
                </div>

                <div className="space-y-3 text-xs">
              {/*data source*/}
              <div className="bg-gray-900 p-3 rounded border border-gray-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                  <span className="text-gray-400">Data Source</span>
                </div>
                <div className="text-white">{isAuthenticated ? 'Space-Track.org (Real Data)' : 'Not Connected'}</div>
              </div>

              {/*stats*/}
              <div className="bg-gray-900 p-3 rounded border border-gray-700 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Active Satellites</span>
                  <span className="text-white font-medium">{Object.keys(positions).length} / {satellites.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Update Rate</span>
                  <span className="text-white font-medium">{updateInterval}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Worker Thread</span>
                  <span className="text-green-400 font-medium">Active</span>
                </div>
              </div>

              {/*tech stack info*/}
              <div className="bg-gray-900 p-3 rounded border border-gray-700 space-y-2">
                <div className="text-gray-400 font-medium mb-2">Technical Details</div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Coordinate System</span>
                  <span className="text-white text-right">ECI → Geodetic → 3D</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Propagation Model</span>
                  <span className="text-white">SGP4</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Library</span>
                  <span className="text-white">satellite.js</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">3D Rendering</span>
                  <span className="text-blue-400">Three.js + R3F</span>
                </div>
              </div>

              {/*categories*/}
              <div className="bg-gray-900 p-3 rounded border border-gray-700">
                <h3 className="font-semibold mb-2 text-sm">Categories</h3>
                <div className="space-y-2">
                  {['station', 'starlink', 'weather', 'communication', 'navigation', 'other'].map(cat => (
                    <div key={cat} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getCategoryColor(cat) }}
                      />
                      <span className="capitalize">{cat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/*display options*/}
              {selectedSatellite && (
                <div className="bg-gray-900 p-3 rounded border border-gray-700 space-y-2">
                  <div className="text-gray-400 font-medium mb-2">Display Options</div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Ground Track</span>
                    <span className={`font-medium ${showGroundTrack ? 'text-green-400' : 'text-gray-500'}`}>
                      {showGroundTrack ? 'On' : 'Off'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Visibility Circle</span>
                    <span className={`font-medium ${showVisibilityCircle ? 'text-green-400' : 'text-gray-500'}`}>
                      {showVisibilityCircle ? 'On' : 'Off'}
                    </span>
                  </div>
                </div>
              )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SatelliteTracker;