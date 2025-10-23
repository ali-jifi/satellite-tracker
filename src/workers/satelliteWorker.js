import * as satellite from 'satellite.js';

self.onmessage = function(e) {
  const { satellites, time } = e.data;
  
  const positions = satellites.map(sat => {
    try {
      const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
      const posVel = satellite.propagate(satrec, time);
      
      if (posVel.position && typeof posVel.position === 'object') {
        const gmst = satellite.gstime(time);
        const geoPos = satellite.eciToGeodetic(posVel.position, gmst);
        
        return {
          id: sat.id,
          name: sat.name,
          latitude: satellite.degreesLat(geoPos.latitude),
          longitude: satellite.degreesLong(geoPos.longitude),
          altitude: geoPos.height
        };
      }
    } catch (error) {
      console.error(`Error calculating position for ${sat.name}:`, error);
    }
    return null;
  }).filter(Boolean);
  
  self.postMessage({ positions });
};