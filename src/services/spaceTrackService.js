// Space-Track.org API service, handles auth and data fetching
// uses vite proxy (/api/spacetrack -> https://www.space-track.org) to avoid CORS

const SPACE_TRACK_BASE_URL = '/api/spacetrack';

class SpaceTrackService {
  constructor() {
    this.username = null;
    this.password = null;
  }

  // set creds for Space-Track.org auth
  setCredentials(username, password) {
    this.username = username;
    this.password = password;
  }

  // auth w/ Space-Track.org via cookie-based POST to /ajaxauth/login
  async login() {
    if (!this.username || !this.password) {
      throw new Error('Space-Track credentials not set. Please set credentials first.');
    }

    try {
      // use /ajaxauth/login for auth
      const response = await fetch(`${SPACE_TRACK_BASE_URL}/ajaxauth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          identity: this.username,
          password: this.password,
        }),
        credentials: 'include', // include cookies in reqs
      });

      if (!response.ok) {
        throw new Error('Authentication failed. Please check your username and password.');
      }

      // test auth by fetching ISS data
      await this.getTLEsByNoradIds([25544]);
      return true;
    } catch (error) {
      console.error('Space-Track authentication failed:', error);
      throw new Error('Authentication failed. Please check your credentials.');
    }
  }

  // build auth URL w/ creds
  buildAuthUrl(query) {
    return `${SPACE_TRACK_BASE_URL}${query}`;
  }

  // make auth'd request to Space-Track.org, sends cookies automatically
  async makeAuthenticatedRequest(query) {
    if (!this.username || !this.password) {
      throw new Error('Credentials not set');
    }

    try {
      const authUrl = `${SPACE_TRACK_BASE_URL}/basicspacedata/query${query}`;

      const response = await fetch(authUrl, {
        method: 'GET',
        credentials: 'include', // send cookies w/ req
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please check your username and password.');
        }
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Space-Track API error:', error);
      throw error;
    }
  }

  // fetch TLE data for specific sats by NORAD IDs
  async getTLEsByNoradIds(noradIds) {
    try {
      const ids = noradIds.join(',');
      const query = `/class/gp/NORAD_CAT_ID/${ids}/orderby/NORAD_CAT_ID,EPOCH/format/json`;

      const data = await this.makeAuthenticatedRequest(query);
      return this.parseSpaceTrackData(data);
    } catch (error) {
      console.error('Error fetching TLE data:', error);
      throw error;
    }
  }

  // fetch TLE data for all active sats (large dataset)
  async getAllActiveTLEs(limit = 100) {
    try {
      const query = `/class/gp/decay_date/null-val/orderby/NORAD_CAT_ID/limit/${limit}/format/json`;

      const data = await this.makeAuthenticatedRequest(query);
      return this.parseSpaceTrackData(data);
    } catch (error) {
      console.error('Error fetching TLE data:', error);
      throw error;
    }
  }

  // fetch TLE data by category
  async getTLEsByCategory(category, limit = 50) {
    try {
      let query;

      switch(category) {
        case 'station':
          // ISS, tiangong, etc - only active stations (decay_date = null)
          query = `/class/gp/OBJECT_TYPE/PAYLOAD/OBJECT_NAME/~~ISS,TIANHE/decay_date/null-val/orderby/NORAD_CAT_ID/limit/${limit}/format/json`;
          break;
        case 'starlink':
          query = `/class/gp/OBJECT_NAME/~~STARLINK/orderby/NORAD_CAT_ID/limit/${limit}/format/json`;
          break;
        case 'weather':
          query = `/class/gp/OBJECT_NAME/~~NOAA,GOES,METOP/orderby/NORAD_CAT_ID/limit/${limit}/format/json`;
          break;
        case 'navigation':
          query = `/class/gp/OBJECT_NAME/~~GPS,GLONASS,GALILEO,BEIDOU/orderby/NORAD_CAT_ID/limit/${limit}/format/json`;
          break;
        default:
          query = `/class/gp/decay_date/null-val/orderby/NORAD_CAT_ID/limit/${limit}/format/json`;
      }

      const data = await this.makeAuthenticatedRequest(query);
      return this.parseSpaceTrackData(data);
    } catch (error) {
      console.error('Error fetching TLE data:', error);
      throw error;
    }
  }

  // parse Space-Track.org data into standard format
  parseSpaceTrackData(data) {
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter(item => {
        // filter out sats w/ missing/invalid TLE data
        return item &&
               item.NORAD_CAT_ID &&
               item.OBJECT_NAME &&
               item.TLE_LINE1 &&
               item.TLE_LINE2 &&
               item.TLE_LINE1.length === 69 &&
               item.TLE_LINE2.length === 69;
      })
      .map(item => ({
        id: parseInt(item.NORAD_CAT_ID),
        name: item.OBJECT_NAME,
        tle1: item.TLE_LINE1,
        tle2: item.TLE_LINE2,
        epoch: item.EPOCH,
        objectType: item.OBJECT_TYPE,
        category: this.determineCategory(item.OBJECT_NAME),
      }));
  }

  // determine sat category from name
  determineCategory(name) {
    const upperName = name.toUpperCase();

    if (upperName.includes('ISS') || upperName.includes('ZARYA') || upperName.includes('TIANGONG') || upperName.includes('TIANHE') || upperName.includes('CSS')) {
      return 'station';
    }
    if (upperName.includes('STARLINK')) {
      return 'starlink';
    }
    if (upperName.includes('NOAA') || upperName.includes('GOES') || upperName.includes('METOP') || upperName.includes('WEATHER')) {
      return 'weather';
    }
    if (upperName.includes('GPS') || upperName.includes('GLONASS') || upperName.includes('GALILEO') || upperName.includes('BEIDOU')) {
      return 'navigation';
    }
    if (upperName.includes('IRIDIUM') || upperName.includes('INTELSAT') || upperName.includes('TELESAT')) {
      return 'communication';
    }

    return 'other';
  }

  // get popular/interesting sats
  async getPopularSatellites() {
    const popularNoradIds = [
      25544, // ISS (ZARYA)
      48274, // tianhe (CSS core module)
      20580, // HST (hubble)
      43013, // starlink-30
      28654, // NOAA 18
      33591, // NOAA 19
      43689, // GPS BIIR-2 PRN 13
      40294, // GOES 16
      41866, // GOES 17
      47964, // starlink-1600
      47967, // starlink-1601
    ];

    return await this.getTLEsByNoradIds(popularNoradIds);
  }
}

// singleton instance
const spaceTrackService = new SpaceTrackService();

export default spaceTrackService;
