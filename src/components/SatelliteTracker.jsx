import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Satellite, Search, Settings, RefreshCw, Eye, Navigation, Clock, Target, Key, Menu, X, ChevronRight, Radio, Crosshair, Gauge, Layers } from 'lucide-react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Sphere, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { TextureLoader } from 'three';
import * as satellite from 'satellite.js';
import spaceTrackService from '../services/spaceTrackService';
import PerformanceMonitor from './PerformanceMonitor';

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

//calc orbital period from mean motion (revs per day)
const getOrbitalPeriod = (satrec) => {
  //mean motion is in revs/day, convert to minutes/orbit
  const meanMotion = satrec.no * (1440 / (2 * Math.PI)); //convert rad/min to rev/day
  const orbitalPeriodMinutes = 1440 / meanMotion; //minutes per orbit
  return orbitalPeriodMinutes;
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
      {/*optimized: 32x32 segments (1024 tris) vs 64x64 (4096 tris) = 75% reduction*/}
      <Sphere args={[6.371, 32, 32]}>
        <meshStandardMaterial
          map={earthTexture}
          normalMap={earthBumpMap}
          normalScale={[0.5, 0.5]}
          roughness={0.7}
          metalness={0.1}
        />
      </Sphere>

      {/*atmosphere*/}
      <Sphere args={[6.5, 32, 32]}>
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

//visibility circle comp - shows area where sat can be seen from
const VisibilityCircle3D = ({ satellitePosition }) => {
  if (!satellitePosition || !satellitePosition.latitude || !satellitePosition.longitude || !satellitePosition.altitude) {
    return null;
  }

  //calc horizon distance based on sat altitude
  const earthRadius = 6.371; //matches earth sphere radius
  const satAlt = satellitePosition.altitude / 1000; //convert to match units (thousands of km)

  //min elevation angle (0 deg = horizon)
  const minElevation = 0;
  const minElevRad = minElevation * Math.PI / 180;

  //calc max distance on earth where sat is visible at min elevation
  const horizonAngle = Math.acos(earthRadius / (earthRadius + satAlt)) - minElevRad;
  const horizonDistance = earthRadius * horizonAngle; //arc distance on earth surface

  //create circle points around satellite ground position
  const points = [];
  const numPoints = 64; //circle resolution

  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;

    //calc point at horizon distance from satellite sub-point
    const lat1 = satellitePosition.latitude * Math.PI / 180;
    const lon1 = satellitePosition.longitude * Math.PI / 180;
    const angularDist = horizonDistance / earthRadius;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDist) +
      Math.cos(lat1) * Math.sin(angularDist) * Math.cos(angle)
    );

    const lon2 = lon1 + Math.atan2(
      Math.sin(angle) * Math.sin(angularDist) * Math.cos(lat1),
      Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2)
    );

    const latitude = lat2 * 180 / Math.PI;
    const longitude = lon2 * 180 / Math.PI;

    //convert to 3d coords matching earth rendering
    const latRad = latitude * Math.PI / 180;
    const lonRad = (longitude + 90) * Math.PI / 180; //add 90 deg offset, texture alignment
    const radius = 6.371 * 1.001; //slightly above surface

    const x = radius * Math.cos(latRad) * Math.sin(lonRad);
    const y = radius * Math.sin(latRad);
    const z = radius * Math.cos(latRad) * Math.cos(lonRad);

    points.push(new THREE.Vector3(x, y, z));
  }

  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <line>
      <primitive object={lineGeometry} attach="geometry" />
      <lineBasicMaterial color="#00ff00" opacity={0.5} transparent linewidth={2} />
    </line>
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
const Scene3D = ({ positions, satellites, selectedSatellite, observerLocation, groundTrack, getCategoryColor, showVisibilityCircle }) => {
  return (
    <>
      <ambientLight intensity={1.2} />
      <pointLight position={[100, 100, 100]} intensity={1.5} />
      <pointLight position={[-100, -100, -100]} intensity={0.5} />

      <Stars radius={300} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <Earth observerLocation={observerLocation} />

      {/*visibility circle for selected sat*/}
      {showVisibilityCircle && selectedSatellite && positions[selectedSatellite.id] && (
        <VisibilityCircle3D
          satellitePosition={positions[selectedSatellite.id]}
        />
      )}

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
  const [groundTrackMode, setGroundTrackMode] = useState('fixed'); //fixed or full
  const [activeTab, setActiveTab] = useState('tracking'); //tracking, passes, visibility
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('popular'); //popular, category, all
  const [selectedCategory, setSelectedCategory] = useState('starlink');
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const workerRef = useRef(null);
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

  //keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'p' || e.key === 'P') {
        setShowPerformanceMonitor(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

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
        let durationMinutes;
        if (groundTrackMode === 'full') {
          //calc full orbital period
          durationMinutes = getOrbitalPeriod(satrec);
        } else {
          //fixed 3 hour duration
          durationMinutes = 180;
        }
        const track = calculateGroundTrack(satrec, new Date(), durationMinutes, 2);

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
  }, [selectedSatellite, showGroundTrack, groundTrackMode]);

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

  const [showDrawer, setShowDrawer] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative" style={{ fontFamily: 'var(--font-mono)' }}>

      {/* ═══ FULL-SCREEN 3D GLOBE ═══ */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [15, 15, 15], fov: 60 }}
          style={{ width: '100%', height: '100%' }}
          gl={{ antialias: true, alpha: true }}
        >
          <Scene3D
            positions={positions}
            satellites={satellites}
            selectedSatellite={selectedSatellite}
            observerLocation={observerLocation}
            groundTrack={showGroundTrack ? groundTrack : []}
            getCategoryColor={getCategoryColor}
            showVisibilityCircle={showVisibilityCircle}
          />
        </Canvas>
      </div>

      {/* ═══ TOP BAR ═══ */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="flex items-center justify-between px-5 py-4">
          {/* Left: Menu + Logo */}
          <div className="flex items-center gap-4 pointer-events-auto">
            <button
              onClick={() => setShowDrawer(!showDrawer)}
              className="glass w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
            >
              {showDrawer ? <X size={18} style={{ color: 'var(--accent)' }} /> : <Menu size={18} style={{ color: 'var(--text-secondary)' }} />}
            </button>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Satellite size={22} style={{ color: 'var(--accent)' }} />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full pulse-glow" style={{ background: 'var(--accent)' }} />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-wide" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                  SATELLITE TRACKER
                </h1>
                <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>
                  Real-time orbital tracking
                </p>
              </div>
            </div>
          </div>

          {/* Center: Status chips */}
          <div className="hidden md:flex items-center gap-3 pointer-events-auto">
            {isAuthenticated && (
              <div className="glass rounded-full px-3 py-1.5 flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                <div className="w-1.5 h-1.5 rounded-full pulse-glow" style={{ background: 'var(--accent)' }} />
                <span style={{ color: 'var(--accent)' }}>{Object.keys(positions).length}</span>
                <span>tracking</span>
              </div>
            )}
            <div className="glass rounded-full px-3 py-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {isAuthenticated && (
              <button
                onClick={refreshTles}
                className="glass rounded-lg px-3 py-2 flex items-center gap-2 text-[11px] hover:bg-white/5 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                title="Refresh TLE data"
              >
                <RefreshCw size={13} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
            <button
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              className={`glass rounded-lg w-10 h-10 flex items-center justify-center transition-colors ${showSettingsPanel ? 'bg-white/5' : 'hover:bg-white/5'}`}
            >
              <Settings size={16} style={{ color: showSettingsPanel ? 'var(--accent)' : 'var(--text-secondary)' }} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ LEFT DRAWER (Satellite List + Tabs) ═══ */}
      {showDrawer && (
        <div className="absolute top-16 left-4 bottom-4 z-40 w-80 glass-solid rounded-xl overflow-hidden flex flex-col drawer-enter">
          {/* Drawer tabs */}
          <div className="flex border-b" style={{ borderColor: 'var(--glass-border)' }}>
            {[
              { id: 'tracking', icon: Crosshair, label: 'Track' },
              { id: 'passes', icon: Clock, label: 'Passes' },
              { id: 'visibility', icon: Eye, label: 'Vis' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 py-3 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors relative"
                style={{ color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-tertiary)' }}
              >
                <tab.icon size={13} />
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{ background: 'var(--accent)' }} />
                )}
              </button>
            ))}
          </div>

          {/* ─── TRACKING TAB ─── */}
          {activeTab === 'tracking' && (
            <>
              <div className="p-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5" size={14} style={{ color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    placeholder="Search satellites..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg text-xs outline-none transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scroll">
                {isLoading && (
                  <div className="flex items-center justify-center p-10">
                    <div className="text-center">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-3" style={{ color: 'var(--accent)' }} />
                      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Loading satellites...</p>
                    </div>
                  </div>
                )}

                {!isLoading && filteredSatellites.length === 0 && (
                  <div className="flex items-center justify-center p-10">
                    <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
                      <Satellite size={24} className="mx-auto mb-2 opacity-40" />
                      <p className="text-[11px]">No satellites found</p>
                    </div>
                  </div>
                )}

                {!isLoading && filteredSatellites.map(sat => {
                  const pos = positions[sat.id];
                  const isActive = selectedSatellite?.id === sat.id;
                  return (
                    <div
                      key={sat.id}
                      onClick={() => setSelectedSatellite(sat)}
                      className="px-3 py-2.5 cursor-pointer transition-all group"
                      style={{
                        borderBottom: '1px solid rgba(56, 243, 191, 0.04)',
                        background: isActive ? 'var(--accent-glow)' : 'transparent',
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: getCategoryColor(sat.category),
                            boxShadow: isActive ? `0 0 8px ${getCategoryColor(sat.category)}` : 'none',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium truncate" style={{ color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>
                              {sat.name}
                            </span>
                            {pos && (
                              <span className="text-[10px] ml-2 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                                {getOrbitType(pos.altitude)}
                              </span>
                            )}
                          </div>
                          {pos && (
                            <div className="flex gap-3 mt-0.5 text-[10px]" style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                              <span>{pos.latitude.toFixed(2)}°</span>
                              <span>{pos.longitude.toFixed(2)}°</span>
                              <span>{pos.altitude.toFixed(0)} km</span>
                            </div>
                          )}
                        </div>
                        <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Category legend */}
              <div className="px-3 py-2 flex flex-wrap gap-x-3 gap-y-1" style={{ borderTop: '1px solid var(--glass-border)' }}>
                {['station', 'starlink', 'weather', 'navigation'].map(cat => (
                  <div key={cat} className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getCategoryColor(cat) }} />
                    {cat}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ─── PASSES TAB ─── */}
          {activeTab === 'passes' && (
            <div className="flex-1 overflow-y-auto custom-scroll">
              <div className="p-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>Observer</span>
                  <button
                    onClick={getUserLocation}
                    disabled={gettingLocation}
                    className="px-2 py-1 rounded-md text-[10px] flex items-center gap-1 transition-colors"
                    style={{
                      background: 'rgba(56, 243, 191, 0.1)',
                      color: 'var(--accent)',
                      border: '1px solid rgba(56, 243, 191, 0.2)',
                    }}
                  >
                    {gettingLocation ? <RefreshCw size={10} className="animate-spin" /> : <MapPin size={10} />}
                    {observerLocation ? 'Update' : 'Set Location'}
                  </button>
                </div>
                {observerLocation ? (
                  <div className="text-[10px] space-y-0.5" style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                    <div>{observerLocation.lat.toFixed(4)}° N, {observerLocation.lon.toFixed(4)}° E</div>
                  </div>
                ) : (
                  <div className="text-[10px] px-2 py-1.5 rounded" style={{ background: 'rgba(251, 191, 36, 0.06)', border: '1px solid rgba(251, 191, 36, 0.15)', color: 'var(--warn)' }}>
                    Set location to enable predictions
                  </div>
                )}
              </div>

              {selectedSatellite ? (
                <>
                  <div className="p-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <div className="text-xs font-medium" style={{ color: 'var(--accent)' }}>{selectedSatellite.name}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {upcomingPasses.length} passes / 24h
                    </div>
                  </div>
                  {upcomingPasses.map((pass, idx) => (
                    <div key={idx} className="p-3 transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid rgba(56, 243, 191, 0.04)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>Pass #{idx + 1}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(56, 243, 191, 0.1)', color: 'var(--accent)' }}>
                          {pass.maxElevation.toFixed(1)}° max
                        </span>
                      </div>
                      <div className="space-y-1 text-[10px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {[
                          ['Start', pass.startTime.toLocaleTimeString()],
                          ['End', pass.endTime.toLocaleTimeString()],
                          ['Duration', formatDuration(pass.duration)],
                          ['Az', `${pass.startAzimuth.toFixed(0)}° → ${pass.endAzimuth.toFixed(0)}°`],
                        ].map(([label, val]) => (
                          <div key={label} className="flex justify-between">
                            <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {upcomingPasses.length === 0 && (
                    <div className="p-8 text-center">
                      <Navigation size={20} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
                      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>No passes above 10°</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center">
                    <Crosshair size={20} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
                    <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Select a satellite</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── VISIBILITY TAB ─── */}
          {activeTab === 'visibility' && (
            <div className="flex-1 overflow-y-auto custom-scroll">
              <div className="p-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>Observer</span>
                  <button
                    onClick={getUserLocation}
                    disabled={gettingLocation}
                    className="px-2 py-1 rounded-md text-[10px] flex items-center gap-1 transition-colors"
                    style={{
                      background: 'rgba(56, 243, 191, 0.1)',
                      color: 'var(--accent)',
                      border: '1px solid rgba(56, 243, 191, 0.2)',
                    }}
                  >
                    {gettingLocation ? <RefreshCw size={10} className="animate-spin" /> : <MapPin size={10} />}
                    {observerLocation ? 'Update' : 'Set Location'}
                  </button>
                </div>
                {observerLocation ? (
                  <div className="text-[10px]" style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                    {observerLocation.lat.toFixed(4)}° N, {observerLocation.lon.toFixed(4)}° E
                  </div>
                ) : (
                  <div className="text-[10px] px-2 py-1.5 rounded" style={{ background: 'rgba(251, 191, 36, 0.06)', border: '1px solid rgba(251, 191, 36, 0.15)', color: 'var(--warn)' }}>
                    Set location for visibility data
                  </div>
                )}
              </div>

              {selectedSatellite && visibility ? (
                <div className="p-3 space-y-4">
                  <div className="text-xs font-medium" style={{ color: 'var(--accent)' }}>{selectedSatellite.name}</div>

                  {/* Visibility status */}
                  <div className="px-3 py-2.5 rounded-lg flex items-center gap-2" style={{
                    background: visibility.isVisible ? 'rgba(56, 243, 191, 0.08)' : 'rgba(244, 63, 94, 0.08)',
                    border: `1px solid ${visibility.isVisible ? 'rgba(56, 243, 191, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`,
                  }}>
                    <Radio size={13} style={{ color: visibility.isVisible ? 'var(--accent)' : 'var(--danger)' }} />
                    <span className="text-[11px] font-medium" style={{ color: visibility.isVisible ? 'var(--accent)' : 'var(--danger)' }}>
                      {visibility.isVisible ? 'VISIBLE' : 'BELOW HORIZON'}
                    </span>
                  </div>

                  {/* Elevation */}
                  <div>
                    <div className="text-[10px] mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Elevation</div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(0, Math.min(100, (visibility.elevation + 90) / 180 * 100))}%`,
                            background: visibility.elevation > 0 ? 'var(--accent)' : 'var(--danger)',
                            boxShadow: `0 0 8px ${visibility.elevation > 0 ? 'var(--accent-dim)' : 'rgba(244,63,94,0.5)'}`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold tabular-nums w-14 text-right" style={{ color: 'var(--text-primary)' }}>
                        {visibility.elevation.toFixed(1)}°
                      </span>
                    </div>
                  </div>

                  {/* Azimuth compass */}
                  <div>
                    <div className="text-[10px] mb-2 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Azimuth</div>
                    <div className="flex items-center gap-4">
                      <div className="relative w-24 h-24">
                        <div className="absolute inset-0 rounded-full" style={{ border: '1px solid var(--glass-border)' }} />
                        <div className="absolute inset-2 rounded-full" style={{ border: '1px solid rgba(56,243,191,0.06)' }} />
                        {['N', 'E', 'S', 'W'].map((d, i) => (
                          <div key={d} className="absolute text-[8px] font-medium" style={{
                            color: 'var(--text-tertiary)',
                            ...(i === 0 ? { top: '-14px', left: '50%', transform: 'translateX(-50%)' } :
                                i === 1 ? { right: '-10px', top: '50%', transform: 'translateY(-50%)' } :
                                i === 2 ? { bottom: '-14px', left: '50%', transform: 'translateX(-50%)' } :
                                { left: '-12px', top: '50%', transform: 'translateY(-50%)' })
                          }}>{d}</div>
                        ))}
                        <div
                          className="absolute top-1/2 left-1/2 w-0.5 h-9 origin-bottom"
                          style={{
                            background: `linear-gradient(to top, transparent, var(--accent))`,
                            transform: `translate(-50%, -100%) rotate(${visibility.azimuth}deg)`,
                            transition: 'transform 0.3s ease',
                          }}
                        >
                          <div className="w-2 h-2 rounded-full absolute -top-1 left-1/2 -translate-x-1/2" style={{ background: 'var(--accent)', boxShadow: '0 0 6px var(--accent-dim)' }} />
                        </div>
                        <div className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ background: 'var(--text-tertiary)' }} />
                      </div>
                      <div>
                        <div className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{visibility.azimuth.toFixed(1)}°</div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {visibility.azimuth >= 337.5 || visibility.azimuth < 22.5 ? 'North' :
                           visibility.azimuth < 67.5 ? 'NE' : visibility.azimuth < 112.5 ? 'East' :
                           visibility.azimuth < 157.5 ? 'SE' : visibility.azimuth < 202.5 ? 'South' :
                           visibility.azimuth < 247.5 ? 'SW' : visibility.azimuth < 292.5 ? 'West' : 'NW'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Range */}
                  <div>
                    <div className="text-[10px] mb-1 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Range</div>
                    <div className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{visibility.range.toFixed(1)} km</div>
                  </div>

                  {upcomingPasses.length > 0 && (
                    <div className="pt-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
                      <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Next Pass</div>
                      <div className="p-2.5 rounded-lg space-y-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        {[
                          ['Start', upcomingPasses[0].startTime.toLocaleTimeString()],
                          ['Max El', `${upcomingPasses[0].maxElevation.toFixed(1)}°`],
                          ['Duration', formatDuration(upcomingPasses[0].duration)],
                        ].map(([l, v]) => (
                          <div key={l} className="flex justify-between text-[10px]">
                            <span style={{ color: 'var(--text-tertiary)' }}>{l}</span>
                            <span style={{ color: l === 'Max El' ? 'var(--accent)' : 'var(--text-secondary)' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center">
                    <Eye size={20} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
                    <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Select a satellite</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ SETTINGS PANEL (Right side) ═══ */}
      {showSettingsPanel && (
        <div className="absolute top-16 right-4 z-40 w-72 glass-solid rounded-xl overflow-hidden fade-in">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>Settings</span>
              <button onClick={() => setShowSettingsPanel(false)} className="hover:opacity-70 transition-opacity">
                <X size={14} style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>

            {/* Data Source */}
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Data Source</div>
              <select
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
              >
                <option value="popular">Popular (ISS, HST...)</option>
                <option value="category">By Category</option>
                <option value="all">All Active (100)</option>
              </select>
            </div>

            {dataSource === 'category' && (
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Category</div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                >
                  <option value="station">Space Stations</option>
                  <option value="starlink">Starlink</option>
                  <option value="weather">Weather</option>
                  <option value="navigation">Navigation</option>
                </select>
              </div>
            )}

            {/* Display */}
            <div className="pt-2" style={{ borderTop: '1px solid var(--glass-border)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Display</div>
              <div className="space-y-2.5">
                <label className="flex items-center gap-2.5 text-[11px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={showGroundTrack} onChange={(e) => setShowGroundTrack(e.target.checked)} />
                  Ground Track
                </label>
                {showGroundTrack && (
                  <div className="ml-5 space-y-1.5">
                    {[['fixed', '3 hours'], ['full', 'Full orbit']].map(([val, label]) => (
                      <label key={val} className="flex items-center gap-2 text-[10px] cursor-pointer" style={{ color: 'var(--text-tertiary)' }}>
                        <input type="radio" name="groundTrackMode" value={val} checked={groundTrackMode === val} onChange={(e) => setGroundTrackMode(e.target.value)} />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
                <label className="flex items-center gap-2.5 text-[11px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={showVisibilityCircle} onChange={(e) => setShowVisibilityCircle(e.target.checked)} />
                  Visibility Circle
                </label>
              </div>
            </div>

            {/* Performance */}
            <div className="pt-2" style={{ borderTop: '1px solid var(--glass-border)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Performance</div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Update interval</span>
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{updateInterval}ms</span>
                </div>
                <input
                  type="range" min="500" max="5000" step="500"
                  value={updateInterval}
                  onChange={(e) => setUpdateInterval(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Tracking toggle */}
            <button
              onClick={() => setIsTracking(!isTracking)}
              className="w-full py-2 rounded-lg text-[11px] font-medium transition-colors"
              style={{
                background: isTracking ? 'rgba(56, 243, 191, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                border: `1px solid ${isTracking ? 'rgba(56, 243, 191, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
                color: isTracking ? 'var(--accent)' : 'var(--danger)',
              }}
            >
              {isTracking ? 'TRACKING ACTIVE' : 'TRACKING PAUSED'}
            </button>

            {/* Auth button */}
            {isAuthenticated && (
              <button
                onClick={() => setShowAuthDialog(true)}
                className="w-full py-2 rounded-lg text-[11px] flex items-center justify-center gap-2 transition-colors hover:bg-white/[0.03]"
                style={{ border: '1px solid var(--glass-border)', color: 'var(--text-tertiary)' }}
              >
                <Key size={12} /> Change Login
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ SELECTED SATELLITE INFO CARD ═══ */}
      {selectedSatellite && positions[selectedSatellite.id] && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 glass-solid rounded-xl info-card-glow fade-in" style={{ minWidth: '420px', maxWidth: '520px' }}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{
                  backgroundColor: getCategoryColor(selectedSatellite.category),
                  boxShadow: `0 0 10px ${getCategoryColor(selectedSatellite.category)}`,
                }} />
                <h3 className="text-sm font-bold tracking-wide" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  {selectedSatellite.name}
                </h3>
                <span className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}>
                  {getOrbitType(positions[selectedSatellite.id].altitude)}
                </span>
              </div>
              <button onClick={() => setSelectedSatellite(null)} className="hover:opacity-70 transition-opacity">
                <X size={14} style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 text-center" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {[
                ['LAT', `${positions[selectedSatellite.id].latitude.toFixed(2)}°`],
                ['LON', `${positions[selectedSatellite.id].longitude.toFixed(2)}°`],
                ['ALT', `${positions[selectedSatellite.id].altitude.toFixed(0)} km`],
                ...(visibility ? [['EL', <span key="el" style={{ color: visibility.isVisible ? 'var(--accent)' : 'var(--danger)' }}>{visibility.elevation.toFixed(1)}°</span>]] : [['EL', '---']]),
              ].map(([label, val]) => (
                <div key={label}>
                  <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
                  <div className="text-xs font-semibold" style={{ color: typeof val === 'string' ? 'var(--text-primary)' : undefined }}>{val}</div>
                </div>
              ))}
            </div>

            {upcomingPasses.length > 0 && (
              <div className="mt-3 pt-2.5 flex items-center gap-2" style={{ borderTop: '1px solid var(--glass-border)' }}>
                <Clock size={11} style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  Next pass in {Math.round((upcomingPasses[0].startTime - new Date()) / 60000)} min
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ BOTTOM-LEFT CONTROLS HINT ═══ */}
      <div className="absolute bottom-5 left-5 z-20 text-[9px] space-y-0.5" style={{ color: 'var(--text-tertiary)' }}>
        <div>Drag to rotate</div>
        <div>Scroll to zoom</div>
        <div>Right-drag to pan</div>
      </div>

      {/* ═══ BOTTOM-RIGHT STATUS ═══ */}
      <div className="absolute bottom-5 right-5 z-20 flex items-center gap-3 text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
        <span>SGP4</span>
        <span>Three.js + R3F</span>
        <span className="flex items-center gap-1">
          <div className="w-1 h-1 rounded-full" style={{ background: isAuthenticated ? 'var(--accent)' : 'var(--warn)' }} />
          {isAuthenticated ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>

      {/* ═══ AUTH DIALOG ═══ */}
      {showAuthDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-solid rounded-2xl p-6 max-w-sm w-full mx-4 fade-in info-card-glow">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(56, 243, 191, 0.1)', border: '1px solid rgba(56, 243, 191, 0.2)' }}>
                <Key size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h2 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Space-Track Login</h2>
                <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Access real satellite data</p>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg mb-4 text-[11px]" style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)', color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-xs outline-none transition-colors"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                  placeholder="your@email.com"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-xs outline-none transition-colors"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                  placeholder="Enter password"
                  disabled={isLoading}
                  onKeyPress={(e) => e.key === 'Enter' && handleAuthentication()}
                />
              </div>
              <button
                onClick={handleAuthentication}
                disabled={isLoading || !username || !password}
                className="w-full py-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                style={{ background: 'var(--accent)', color: '#000' }}
              >
                {isLoading ? (
                  <><RefreshCw size={13} className="animate-spin" /> Authenticating...</>
                ) : (
                  <><Key size={13} /> Sign In</>
                )}
              </button>
            </div>

            <p className="text-[9px] mt-4 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
              No account? <a href="https://www.space-track.org/auth/createAccount" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Create one free</a>
            </p>
          </div>
        </div>
      )}

      {/* ═══ LOCATION PROMPT ═══ */}
      {showLocationPrompt && !showAuthDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-solid rounded-2xl p-6 max-w-sm w-full mx-4 fade-in info-card-glow">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(56, 243, 191, 0.1)', border: '1px solid rgba(56, 243, 191, 0.2)' }}>
                <MapPin size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h2 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Your Location</h2>
                <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Enable pass predictions</p>
              </div>
            </div>

            <div className="p-3 rounded-lg mb-4 text-[10px] space-y-1" style={{ background: 'rgba(56, 243, 191, 0.04)', border: '1px solid rgba(56, 243, 191, 0.1)', color: 'var(--text-secondary)' }}>
              <p>Used for:</p>
              <ul className="space-y-0.5 ml-2" style={{ color: 'var(--text-tertiary)' }}>
                <li>Pass predictions over your location</li>
                <li>Elevation/azimuth for viewing</li>
                <li>Observer marker on the globe</li>
              </ul>
            </div>

            <div className="space-y-2">
              <button
                onClick={getUserLocation}
                disabled={gettingLocation}
                className="w-full py-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                style={{ background: 'var(--accent)', color: '#000' }}
              >
                {gettingLocation ? (
                  <><RefreshCw size={13} className="animate-spin" /> Getting Location...</>
                ) : (
                  <><MapPin size={13} /> Share My Location</>
                )}
              </button>
              <button
                onClick={skipLocationSetup}
                disabled={gettingLocation}
                className="w-full py-2 rounded-lg text-[11px] transition-colors hover:bg-white/[0.03]"
                style={{ border: '1px solid var(--glass-border)', color: 'var(--text-tertiary)' }}
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PERFORMANCE MONITOR ═══ */}
      <PerformanceMonitor isVisible={showPerformanceMonitor} />
    </div>
  );
};

export default SatelliteTracker;