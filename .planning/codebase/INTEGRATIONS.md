# External Integrations

**Analysis Date:** 2026-04-06

## APIs & External Services

**Satellite Tracking Data:**
- Space-Track.org API - Source of real TLE (Two-Line Element) data for satellite orbit calculations
  - SDK/Client: Native `fetch` API with custom `SpaceTrackService` class
  - Auth: Cookie-based authentication (`VITE_SPACETRACK_USERNAME`, `VITE_SPACETRACK_PASSWORD`)
  - Implementation file: `src/services/spaceTrackService.js`
  - Base URL (proxied during dev): `/api/spacetrack` → `https://www.space-track.org`
  - Rate Limits: 300 requests per hour, 30 requests per minute

**Alternative Satellite Data Source:**
- CelesTrak API - Free alternative source for TLE data
  - SDK/Client: Native `fetch` API
  - Auth: None (public API)
  - Implementation file: `src/utils/tleData.js` - `fetchTLEsFromCelesTrak()` function
  - URL: `https://celestrak.org/NORAD/elements/gp.php?GROUP={category}&FORMAT=tle`
  - Categories: stations, starlink, weather, navigation, etc.
  - No rate limiting documented

## Data Storage

**Databases:**
- None - This is a frontend-only SPA

**File Storage:**
- Local filesystem - No backend file storage
- Local browser storage: `localStorage` used for credential caching (UNSAFE for production, temporary storage only)

**Client-Side Caching:**
- Browser localStorage - Temporarily stores Space-Track credentials after login
  - `spacetrack_username` - Cached username
  - `spacetrack_password` - Cached password
  - Warning: Not production-safe per code comments in `src/components/SatelliteTracker.jsx` (line 661)

**Caching:**
- None implemented - No Redis, Memcached, or other caching layer

## Authentication & Identity

**Auth Provider:**
- Space-Track.org custom authentication (cookie-based)
- Implementation: `SpaceTrackService` class in `src/services/spaceTrackService.js`
- Approach:
  - POST request to `/ajaxauth/login` with credentials
  - Credentials: username and password in `application/x-www-form-urlencoded` body
  - Cookie-based session maintained via `credentials: 'include'` in fetch calls
  - Validation: Test authentication by fetching ISS TLE data after login

**Credential Sources (in priority order):**
1. Environment variables: `VITE_SPACETRACK_USERNAME` and `VITE_SPACETRACK_PASSWORD`
2. Browser localStorage: `spacetrack_username` and `spacetrack_password` (fallback)
3. Manual login dialog: User input at runtime (last resort)

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, DataDog, or similar error tracking service

**Logs:**
- Browser console only (`console.error()`, `console.warn()` calls)
- Development monitoring: Custom `performanceMonitor.js` for performance metrics in dev mode
  - File: `src/utils/performanceMonitor.js`
  - Enabled via: `import.meta.env.DEV`
  - Tracks: FPS, memory usage, render time, update frequency

**Performance Monitoring:**
- Custom Performance Monitor component: `src/components/PerformanceMonitor.jsx`
- Metrics tracked in development only

## CI/CD & Deployment

**Hosting:**
- Static SPA hosting (Vercel, Netlify, S3, etc.) - No specific platform configured
- Must configure CORS proxy or Space-Track.org CORS headers for production deployment

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, Jenkins, or Travis CI configuration files

**Build:**
- Vite build process: `npm run build` → outputs to `dist/` directory
- Development: `npm run dev` with Vite dev server on localhost:5173

## Environment Configuration

**Required env vars:**
- `VITE_SPACETRACK_USERNAME` - Space-Track.org account username
- `VITE_SPACETRACK_PASSWORD` - Space-Track.org account password

**Optional env vars:**
- `VITE_DEBUG` - Not used currently (framework ready)

**Development Only:**
- Vite proxy at `/api/spacetrack` handles CORS issues
- Automatically sets `import.meta.env.DEV = true` in development

**Secrets location:**
- `.env` file in project root (must contain credentials)
- `.env.example` file referenced in README (for documentation)
- Git should ignore `.env` file (standard practice, verify .gitignore)

## Webhooks & Callbacks

**Incoming:**
- None - This is a read-only client application

**Outgoing:**
- None - No webhook callbacks or external notifications

## Data Flow Summary

**TLE Data Acquisition:**

1. User provides Space-Track.org credentials (via env vars, localStorage, or login dialog)
2. `SpaceTrackService.login()` authenticates with Space-Track API
   - File: `src/services/spaceTrackService.js` (lines 30-60)
3. Request routed through Vite proxy (dev) or direct HTTPS (production)
4. Session maintained via cookies
5. Subsequent requests use `getTLEsByNoradIds()`, `getTLEsByCategory()`, or `getAllActiveTLEs()` methods
6. Space-Track API returns JSON with satellite TLE data
7. `parseSpaceTrackData()` validates and transforms API response (lines 169-194)
8. Data passed to satellite.js for SGP4 propagation calculations
9. Calculated positions sent to Web Worker for batch processing

**Alternative CelesTrak Flow:**

1. Direct fetch to CelesTrak public API (no authentication needed)
2. Raw TLE text format returned
3. `parseTLEText()` parses three-line format into satellite objects
4. Same downstream processing as Space-Track data

**CORS Handling:**

- **Development:** Vite proxy at `vite.config.js` (lines 10-34) rewrites requests
  - Adds User-Agent header
  - Forwards browser cookies
  - Returns Set-Cookie headers to browser
- **Production:** Must implement reverse proxy or request CORS headers from Space-Track.org support

## API Reference

**Space-Track.org Endpoints Used:**

- `/ajaxauth/login` - Authentication endpoint (POST)
- `/basicspacedata/query/class/gp/...` - TLE query endpoint (GET)

**Query Parameters:**
- `NORAD_CAT_ID` - Filter by satellite NORAD catalog ID
- `decay_date/null-val` - Filter for active satellites only
- `orderby/` - Sort results
- `limit/` - Limit number of results
- `format/json` or `format/tle` - Response format

---

*Integration audit: 2026-04-06*
