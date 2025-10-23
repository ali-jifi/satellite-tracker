/**
 * Space-Track.org API Service
 *
 * This service handles authentication and data fetching from Space-Track.org
 * You need to create a free account at https://www.space-track.org/auth/createAccount
 *
 * Note: We use a Vite proxy to avoid CORS issues.
 * In development, requests to /api/spacetrack are proxied to https://www.space-track.org
 */

const SPACE_TRACK_BASE_URL = '/api/spacetrack';

class SpaceTrackService {
  constructor() {
    this.username = null;
    this.password = null;
  }

  /**
   * Set credentials for Space-Track.org authentication
   */
  setCredentials(username, password) {
    this.username = username;
    this.password = password;
  }

  /**
   * Authenticate with Space-Track.org using cookie-based auth
   * Space-Track.org requires POST to /ajaxauth/login with identity and password
   */
  async login() {
    if (!this.username || !this.password) {
      throw new Error('Space-Track credentials not set. Please set credentials first.');
    }

    try {
      // Space-Track.org uses /ajaxauth/login for authentication
      const response = await fetch(`${SPACE_TRACK_BASE_URL}/ajaxauth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          identity: this.username,
          password: this.password,
        }),
        credentials: 'include', // Important: include cookies in requests
      });

      if (!response.ok) {
        throw new Error('Authentication failed. Please check your username and password.');
      }

      // Test the authentication by fetching ISS data
      await this.getTLEsByNoradIds([25544]);
      return true;
    } catch (error) {
      console.error('Space-Track authentication failed:', error);
      throw new Error('Authentication failed. Please check your credentials.');
    }
  }

  /**
   * Build authenticated URL with credentials
   */
  buildAuthUrl(query) {
    return `${SPACE_TRACK_BASE_URL}${query}`;
  }

  /**
   * Make authenticated request to Space-Track.org
   * Uses cookie-based authentication - cookies are automatically sent with credentials: 'include'
   */
  async makeAuthenticatedRequest(query) {
    if (!this.username || !this.password) {
      throw new Error('Credentials not set');
    }

    try {
      const authUrl = `${SPACE_TRACK_BASE_URL}/basicspacedata/query${query}`;

      const response = await fetch(authUrl, {
        method: 'GET',
        credentials: 'include', // Send cookies with the request
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

  /**
   * Fetch TLE data for specific satellites
   * @param {Array} noradIds - Array of NORAD catalog IDs
   */
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

  /**
   * Fetch TLE data for all active satellites (WARNING: Large dataset)
   */
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

  /**
   * Fetch TLE data by category
   */
  async getTLEsByCategory(category, limit = 50) {
    try {
      let query;

      switch(category) {
        case 'station':
          // ISS, Tiangong, etc.
          query = `/class/gp/OBJECT_TYPE/PAYLOAD/OBJECT_NAME/~~ISS,TIANGONG/orderby/NORAD_CAT_ID/limit/${limit}/format/json`;
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

  /**
   * Parse Space-Track.org data into our format
   */
  parseSpaceTrackData(data) {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(item => ({
      id: parseInt(item.NORAD_CAT_ID),
      name: item.OBJECT_NAME,
      tle1: item.TLE_LINE1,
      tle2: item.TLE_LINE2,
      epoch: item.EPOCH,
      objectType: item.OBJECT_TYPE,
      category: this.determineCategory(item.OBJECT_NAME),
    }));
  }

  /**
   * Determine satellite category from name
   */
  determineCategory(name) {
    const upperName = name.toUpperCase();

    if (upperName.includes('ISS') || upperName.includes('ZARYA') || upperName.includes('TIANGONG')) {
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

  /**
   * Get popular/interesting satellites
   */
  async getPopularSatellites() {
    const popularNoradIds = [
      25544, // ISS (ZARYA)
      20580, // HST (Hubble Space Telescope)
      37849, // TIANGONG 1
      43013, // STARLINK-30
      28654, // NOAA 18
      33591, // NOAA 19
      43689, // GPS BIIR-2  (PRN 13)
      40294, // GOES 16
      41866, // GOES 17
      48274, // STARLINK-1600
      48275, // STARLINK-1601
    ];

    return await this.getTLEsByNoradIds(popularNoradIds);
  }
}

// Create singleton instance
const spaceTrackService = new SpaceTrackService();

export default spaceTrackService;
