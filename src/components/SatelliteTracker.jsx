import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Satellite, Search, Settings, RefreshCw, Eye, Navigation, Clock, Target, Key } from 'lucide-react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Sphere, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { TextureLoader } from 'three';
import * as satellite from 'satellite.js';
import spaceTrackService from '../services/spaceTrackService';

// Ground track calculation
const calculateGroundTrack = (satrec, startTime, durationMinutes, step = 1) => {
  const points = [];
  
  for (let i = 0; i < durationMinutes; i += step) {
    const time = new Date(startTime.getTime() + i * 60000);
    const posVel = satellite.propagate(satrec, time);
    
    if (posVel.position) {
      const gmst = satellite.gstime(time);
      const geoPos = satellite.eciToGeodetic(posVel.position, gmst);
      
      points.push({
        latitude: satellite.degreesLat(geoPos.latitude),
        longitude: satellite.degreesLong(geoPos.longitude),
        altitude: geoPos.height,
        time: time
      });
    }
  }
  
  return points;
};

// Visibility calculation
const calculateVisibility = (satPos, observerLat, observerLon, observerAlt = 0) => {
  // Convert observer position to ECEF
  const earthRadius = 6371;
  const obsLatRad = observerLat * Math.PI / 180;
  const obsLonRad = observerLon * Math.PI / 180;
  
  const obsX = (earthRadius + observerAlt / 1000) * Math.cos(obsLatRad) * Math.cos(obsLonRad);
  const obsY = (earthRadius + observerAlt / 1000) * Math.cos(obsLatRad) * Math.sin(obsLonRad);
  const obsZ = (earthRadius + observerAlt / 1000) * Math.sin(obsLatRad);
  
  // Convert satellite position to ECEF
  const satLatRad = satPos.latitude * Math.PI / 180;
  const satLonRad = satPos.longitude * Math.PI / 180;
  const satRadius = earthRadius + satPos.altitude;
  
  const satX = satRadius * Math.cos(satLatRad) * Math.cos(satLonRad);
  const satY = satRadius * Math.cos(satLatRad) * Math.sin(satLonRad);
  const satZ = satRadius * Math.sin(satLatRad);
  
  // Calculate range vector
  const dx = satX - obsX;
  const dy = satY - obsY;
  const dz = satZ - obsZ;
  
  const range = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  // Calculate elevation angle
  const rangeHorizontal = Math.sqrt(dx * dx + dy * dy);
  const elevation = Math.atan2(dz, rangeHorizontal) * 180 / Math.PI;
  
  // Calculate azimuth
  const azimuth = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  
  // Check if satellite is above horizon
  const isVisible = elevation > 0;
  
  return {
    range,
    elevation,
    azimuth,
    isVisible
  };
};

// Pass prediction
const predictPasses = (satrec, observerLat, observerLon, startTime, hours = 24, minElevation = 10) => {
  const passes = [];
  let inPass = false;
  let currentPass = null;
  
  // Check every minute for the specified duration
  for (let i = 0; i < hours * 60; i++) {
    const time = new Date(startTime.getTime() + i * 60000);
    const posVel = satellite.propagate(satrec, time);
    
    if (posVel.position) {
      const gmst = satellite.gstime(time);
      const geoPos = satellite.eciToGeodetic(posVel.position, gmst);
      const satPos = {
        latitude: satellite.degreesLat(geoPos.latitude),
        longitude: satellite.degreesLong(geoPos.longitude),
        altitude: geoPos.height
      };
      
      const visibility = calculateVisibility(satPos, observerLat, observerLon);
      
      // Detect pass start
      if (!inPass && visibility.elevation > minElevation) {
        inPass = true;
        currentPass = {
          startTime: time,
          maxElevation: visibility.elevation,
          maxElevationTime: time,
          startAzimuth: visibility.azimuth
        };
      }
      
      // Update max elevation during pass
      if (inPass && visibility.elevation > currentPass.maxElevation) {
        currentPass.maxElevation = visibility.elevation;
        currentPass.maxElevationTime = time;
      }
      
      // Detect pass end
      if (inPass && visibility.elevation < minElevation) {
        inPass = false;
        currentPass.endTime = time;
        currentPass.endAzimuth = visibility.azimuth;
        currentPass.duration = (currentPass.endTime - currentPass.startTime) / 60000; // minutes
        passes.push(currentPass);
        currentPass = null;
      }
    }
  }
  
  return passes;
};

// Web Worker simulation using real satellite.js
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
          // Parse TLE using real satellite.js
          const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);

          // Propagate to current time
          const positionAndVelocity = satellite.propagate(satrec, time);

          // Check for errors
          if (positionAndVelocity.position && !positionAndVelocity.position.error) {
            const gmst = satellite.gstime(time);
            const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

            return {
              id: sat.id,
              name: sat.name,
              latitude: satellite.degreesLat(positionGd.latitude),
              longitude: satellite.degreesLong(positionGd.longitude),
              altitude: positionGd.height
            };
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

// Helper function to safely propagate satellite position
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

// 3D Earth Component
const Earth = ({ observerLocation }) => {
  // Load Earth textures from NASA Blue Marble
  // Using free NASA textures - you can replace these URLs with your own higher quality textures
  const earthTexture = useLoader(
    TextureLoader,
    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg'
  );

  // Optional: Load bump/normal map for more detail
  const earthBumpMap = useLoader(
    TextureLoader,
    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_normal_2048.jpg'
  );

  return (
    <group>
      {/* Earth sphere - no rotation, we adjust longitude instead */}
      <Sphere args={[6.371, 64, 64]}>
        <meshStandardMaterial
          map={earthTexture}
          normalMap={earthBumpMap}
          normalScale={[0.5, 0.5]}
          roughness={0.7}
          metalness={0.1}
        />
      </Sphere>

      {/* Atmosphere */}
      <Sphere args={[6.5, 64, 64]}>
        <meshBasicMaterial
          color="#4dabf7"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Observer location marker */}
      {observerLocation && (
        <group>
          {(() => {
            // Convert lat/lon to radians
            const latRad = observerLocation.lat * Math.PI / 180;
            // Add 90° to longitude to compensate for Earth texture orientation
            const lonRad = (observerLocation.lon + 90) * Math.PI / 180;
            const radius = 6.371;

            // Spherical to Cartesian conversion
            const x = radius * Math.cos(latRad) * Math.sin(lonRad);
            const y = radius * Math.sin(latRad);
            const z = radius * Math.cos(latRad) * Math.cos(lonRad);

            return (
              <group>
                {/* Main marker */}
                <mesh position={[x, y, z]}>
                  <sphereGeometry args={[0.15, 32, 32]} />
                  <meshBasicMaterial color="#ff0000" />
                </mesh>

                {/* Outer glow */}
                <mesh position={[x, y, z]}>
                  <sphereGeometry args={[0.25, 32, 32]} />
                  <meshBasicMaterial
                    color="#ff0000"
                    transparent
                    opacity={0.4}
                  />
                </mesh>

                {/* Large pulsing ring */}
                <mesh position={[x, y, z]}>
                  <sphereGeometry args={[0.35, 32, 32]} />
                  <meshBasicMaterial
                    color="#ff3333"
                    transparent
                    opacity={0.2}
                    side={THREE.DoubleSide}
                  />
                </mesh>

                {/* Vertical line to center (for visibility) */}
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

// 3D Satellite Component
const Satellite3D = ({ position, color, isSelected, name }) => {
  if (!position) return null;

  // Convert geodetic coordinates to 3D position with REALISTIC altitude
  // Earth radius: 6.371 = 6371 km in scene units
  // Satellite altitude is in km
  // Example: ISS at ~420km altitude -> radius = 6.371 + 0.420 = 6.791
  const latRad = position.latitude * Math.PI / 180;
  const lonRad = (position.longitude + 90) * Math.PI / 180; // Add 90° offset for texture alignment
  const altitude = position.altitude; // in km
  const earthRadius = 6.371; // represents 6371 km
  const radius = earthRadius + (altitude / 1000); // Convert km to thousands of km

  // Spherical to Cartesian conversion matching location marker
  const x = radius * Math.cos(latRad) * Math.sin(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * Math.cos(latRad) * Math.cos(lonRad);

  // Calculate surface point for altitude line
  const surfaceRadius = earthRadius;
  const surfaceX = surfaceRadius * Math.cos(latRad) * Math.sin(lonRad);
  const surfaceY = surfaceRadius * Math.sin(latRad);
  const surfaceZ = surfaceRadius * Math.cos(latRad) * Math.cos(lonRad);

  return (
    <group position={[x, y, z]}>
      {/* Main satellite body */}
      <mesh>
        <sphereGeometry args={[isSelected ? 0.1 : 0.06, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[isSelected ? 0.15 : 0.09, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Outer glow ring */}
      <mesh>
        <sphereGeometry args={[isSelected ? 0.2 : 0.12, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2}
        />
      </mesh>

      {/* Altitude line from Earth surface to satellite */}
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

// Ground Track Component
const GroundTrack3D = ({ groundTrack, color }) => {
  if (!groundTrack || groundTrack.length < 2) return null;

  const points = groundTrack.map(point => {
    const latRad = point.latitude * Math.PI / 180;
    const lonRad = (point.longitude + 90) * Math.PI / 180; // Add 90° offset for texture alignment
    const radius = 6.371 + point.altitude / 1000;

    // Spherical to Cartesian conversion matching location marker
    const x = radius * Math.cos(latRad) * Math.sin(lonRad);
    const y = radius * Math.sin(latRad);
    const z = radius * Math.cos(latRad) * Math.cos(lonRad);

    return new THREE.Vector3(x, y, z);
  });

  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <line>
      <primitive object={lineGeometry} attach="geometry" />
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
};

// 3D Scene Component
const Scene3D = ({ positions, satellites, selectedSatellite, observerLocation, groundTrack, getCategoryColor }) => {
  return (
    <>
      <ambientLight intensity={1.2} />
      <pointLight position={[100, 100, 100]} intensity={1.5} />
      <pointLight position={[-100, -100, -100]} intensity={0.5} />

      <Stars radius={300} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <Earth observerLocation={observerLocation} />

      {/* Ground track for selected satellite */}
      {selectedSatellite && groundTrack && groundTrack.length > 0 && (
        <GroundTrack3D
          groundTrack={groundTrack}
          color={getCategoryColor(selectedSatellite.category)}
        />
      )}

      {/* Satellites */}
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
  const [observerLocation, setObserverLocation] = useState(null); // No default location
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
  const [groundTrack, setGroundTrack] = useState([]);
  const [visibility, setVisibility] = useState(null);
  const [upcomingPasses, setUpcomingPasses] = useState([]);
  const [showGroundTrack, setShowGroundTrack] = useState(true);
  const [showVisibilityCircle, setShowVisibilityCircle] = useState(true);
  const [activeTab, setActiveTab] = useState('tracking'); // tracking, passes, visibility
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('popular'); // popular, category, all
  const [selectedCategory, setSelectedCategory] = useState('starlink');
  const workerRef = useRef(null);
  const mapRef = useRef(null);
  const animationRef = useRef(null);

  // Authentication handler
  const handleAuthentication = async () => {
    setIsLoading(true);
    setError(null);

    try {
      spaceTrackService.setCredentials(username, password);
      await spaceTrackService.login();
      setIsAuthenticated(true);
      setShowAuthDialog(false);

      // Save credentials to localStorage (note: not secure for production)
      localStorage.setItem('spacetrack_username', username);
      localStorage.setItem('spacetrack_password', password);

      // Load satellites after successful authentication
      await loadSatellites();
    } catch (error) {
      setError('Authentication failed. Please check your credentials.');
      console.error('Authentication error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load satellites from Space-Track.org
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

      setSatellites(satelliteData);
      setLastTleUpdate(new Date());
    } catch (error) {
      setError('Failed to load satellite data. Please check your connection and try again.');
      console.error('Load satellites error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check for environment variables or saved credentials on mount
  useEffect(() => {
    // First, check for environment variables
    const envUsername = import.meta.env.VITE_SPACETRACK_USERNAME;
    const envPassword = import.meta.env.VITE_SPACETRACK_PASSWORD;

    // Check if environment variables are set and not placeholder values
    if (envUsername && envPassword &&
        envUsername !== 'your_username_here' &&
        envPassword !== 'your_password_here') {
      setUsername(envUsername);
      setPassword(envPassword);
      spaceTrackService.setCredentials(envUsername, envPassword);

      // Try to authenticate automatically with env variables
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

    // If no env variables, check localStorage
    const savedUsername = localStorage.getItem('spacetrack_username');
    const savedPassword = localStorage.getItem('spacetrack_password');

    if (savedUsername && savedPassword) {
      setUsername(savedUsername);
      setPassword(savedPassword);
      spaceTrackService.setCredentials(savedUsername, savedPassword);

      // Try to authenticate automatically
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

  // Reload satellites when data source or category changes
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

  // Calculate ground track when satellite is selected
  useEffect(() => {
    if (selectedSatellite && showGroundTrack) {
      const satrec = satellite.twoline2satrec(selectedSatellite.tle1, selectedSatellite.tle2);
      const track = calculateGroundTrack(satrec, new Date(), 180, 2); // 3 hours, 2 min steps
      setGroundTrack(track);
    } else {
      setGroundTrack([]);
    }
  }, [selectedSatellite, showGroundTrack]);

  // Calculate visibility when satellite is selected
  useEffect(() => {
    if (selectedSatellite && positions[selectedSatellite.id]) {
      const satPos = positions[selectedSatellite.id];
      const vis = calculateVisibility(satPos, observerLocation.lat, observerLocation.lon);
      setVisibility(vis);
    } else {
      setVisibility(null);
    }
  }, [selectedSatellite, positions, observerLocation]);

  // Calculate pass predictions
  useEffect(() => {
    if (selectedSatellite) {
      const satrec = satellite.twoline2satrec(selectedSatellite.tle1, selectedSatellite.tle2);
      const passes = predictPasses(satrec, observerLocation.lat, observerLocation.lon, new Date(), 24, 10);
      setUpcomingPasses(passes);
    } else {
      setUpcomingPasses([]);
    }
  }, [selectedSatellite, observerLocation]);

  const refreshTles = async () => {
    if (isAuthenticated) {
      await loadSatellites();
    }
  };

  // Get user's actual location using browser geolocation
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
      navigation: '#9370db'
    };
    return colors[category] || '#ffffff';
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="h-screen w-full bg-gray-900 text-white flex flex-col">
      {/* Authentication Dialog */}
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

      {/* Location Prompt Dialog */}
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

      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2">
            <Satellite className="text-blue-400" size={24} />
            <h1 className="text-lg font-bold">Satellite Tracker</h1>
          </div>

          <div className="flex items-center gap-4 text-xs">
            {/* Connection Status */}
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
              <span className="text-gray-300">
                {isAuthenticated ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Satellite Count */}
            {isAuthenticated && (
              <div className="flex items-center gap-1.5">
                <Target size={14} className="text-blue-400" />
                <span className="text-gray-300">{satellites.length} Satellites</span>
              </div>
            )}

            {/* Last Update */}
            {isAuthenticated && (
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-blue-400" />
                <span className="text-gray-300">Updated {lastTleUpdate.toLocaleTimeString()}</span>
              </div>
            )}

            {/* Selected Satellite */}
            {selectedSatellite && (
              <div className="flex items-center gap-1.5">
                <Navigation size={14} className="text-green-400" />
                <span className="text-gray-300">{selectedSatellite.name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={refreshTles}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-1.5 text-sm"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1.5 text-sm"
          >
            <Settings size={14} />
            Settings
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
          {/* Tabs */}
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

          {/* Tracking Tab */}
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

              {showSettings && (
                <div className="p-4 border-b border-gray-700 bg-gray-750">
                  <h3 className="font-semibold mb-3">Data Source</h3>
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Select Data Source</label>
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
                        <label className="text-sm text-gray-400 mb-2 block">Category</label>
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

                  <h3 className="font-semibold mb-3 pt-3 border-t border-gray-600">Performance Settings</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-400">Update Interval (ms)</label>
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
                    <div className="flex gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={showGroundTrack}
                          onChange={(e) => setShowGroundTrack(e.target.checked)}
                          className="rounded"
                        />
                        Ground Track
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={showVisibilityCircle}
                          onChange={(e) => setShowVisibilityCircle(e.target.checked)}
                          className="rounded"
                        />
                        Visibility
                      </label>
                    </div>
                    <button
                      onClick={() => setIsTracking(!isTracking)}
                      className={`w-full py-2 rounded ${isTracking ? 'bg-green-600' : 'bg-red-600'}`}
                    >
                      {isTracking ? 'Tracking Active' : 'Tracking Paused'}
                    </button>
                  </div>
                </div>
              )}

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

          {/* Passes Tab */}
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

          {/* Visibility Tab */}
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
                          {/* Compass */}
                          <div className="absolute inset-0 border-2 border-gray-600 rounded-full" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-xs text-gray-400">
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2">N</div>
                              <div className="absolute -right-6 top-1/2 -translate-y-1/2">E</div>
                              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">S</div>
                              <div className="absolute -left-6 top-1/2 -translate-y-1/2">W</div>
                            </div>
                          </div>
                          {/* Direction pointer */}
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

        {/* 3D View */}
        <div className="flex-1 relative bg-black">
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

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-60 rounded p-4">
            <h3 className="font-semibold mb-2 text-sm">Categories</h3>
            <div className="space-y-2 text-xs">
              {['station', 'starlink', 'weather', 'communication', 'navigation'].map(cat => (
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

          {/* Controls hint */}
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 rounded p-3 text-xs text-gray-300">
            <div className="font-semibold mb-1">3D Controls</div>
            <div>Left Click + Drag: Rotate</div>
            <div>Right Click + Drag: Pan</div>
            <div>Scroll: Zoom</div>
          </div>

          {/* Selected Satellite Info */}
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

        {/* Right Sidebar - System Status */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col overflow-y-auto">
          <div className="p-4">
            <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
              <Settings size={16} className="text-blue-400" />
              System Status
            </h3>

            <div className="space-y-3 text-xs">
              {/* Data Source */}
              <div className="bg-gray-900 p-3 rounded border border-gray-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                  <span className="text-gray-400">Data Source</span>
                </div>
                <div className="text-white">{isAuthenticated ? 'Space-Track.org (Real Data)' : 'Not Connected'}</div>
              </div>

              {/* Statistics */}
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

              {/* Technical Info */}
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

              {/* Display Options */}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default SatelliteTracker;