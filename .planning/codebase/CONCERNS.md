# Codebase Concerns

**Analysis Date:** 2026-04-06

## Security Issues

**Credentials Stored in localStorage (CRITICAL):**
- Issue: Plaintext username and password stored in browser localStorage after successful authentication
- Files: `src/components/SatelliteTracker.jsx` (lines 661-663), lines 775-776
- Impact: Any code with access to localStorage can steal credentials; XSS vulnerabilities could expose them; credentials persist across sessions unencrypted
- Workaround: Currently marked with comment "NOT SAFE FOR PROD YET" but still active
- Fix approach: Replace with secure cookie-based session tokens or OAuth2 flow. Never store plaintext credentials in browser storage. Use httpOnly, Secure cookies for session management instead.

**Plaintext Credential Handling:**
- Issue: Credentials stored in component state (`useState`) and passed around without encryption or secure transport mechanisms beyond basic fetch API
- Files: `src/components/SatelliteTracker.jsx` (lines 640-641), `src/services/spaceTrackService.js` (lines 21-23)
- Impact: Credentials visible in React DevTools, component props inspection, memory dumps
- Workaround: None
- Fix approach: Implement backend proxy/middleware to handle Space-Track authentication. Frontend should never handle raw credentials. Use token refresh flows instead.

**Password Field Input Type Exists:**
- Issue: While password input field is present (line 1718), credentials are logged to console in error handlers
- Files: `src/services/spaceTrackService.js` (lines 96, 57, 128, 113)
- Impact: Error logs may leak partial credential information
- Fix approach: Sanitize error messages to never include user input or credential-related data in console logs.

## Tech Debt

**Monolithic Component (Major):**
- Issue: `SatelliteTracker.jsx` is 1803 lines in a single component
- Files: `src/components/SatelliteTracker.jsx`
- Impact: Difficult to test, maintain, or reason about. 25+ useState calls (lines 621-646). Complex state management with interdependencies. Renders both UI and 3D canvas. Handles authentication, data fetching, calculations, and visualization.
- Safe modification: Break into smaller components:
  - AuthenticationPanel (handles login/logout)
  - SatelliteList (displays satellite catalog)
  - GlobeViewer (wraps Canvas and OrbitControls)
  - ControlPanel (settings, ground track toggle, etc.)
  - LocationPrompt (geolocation flow)
  - Test coverage for each would be simpler
- Priority: High - current structure blocks effective testing and future feature development

**No TypeScript:**
- Issue: JavaScript codebase without type definitions
- Files: All source files (`src/**/*.js`, `src/**/*.jsx`)
- Impact: Runtime errors not caught at development time; IDE autocomplete limited; refactoring risky
- Fix approach: Migrate to TypeScript gradually. Start with utility files (`performanceMonitor.js`, `spaceTrackService.js`) which have clear APIs.

**Hardcoded Magic Numbers:**
- Issue: Orbital calculations, thresholds, and UI constants scattered throughout
- Files: `src/components/SatelliteTracker.jsx` (line 80 "earthRadius = 6371", line 897 "tleAgeDays", line 115 "< 30" FPS threshold)
- Impact: Difficult to maintain, modify, or understand why specific values were chosen
- Fix approach: Extract to configuration constants file (`src/constants.js`):
  ```javascript
  export const EARTH_RADIUS_KM = 6371;
  export const TLE_AGE_WARNING_DAYS = 7;
  export const PERFORMANCE_LOW_FPS_THRESHOLD = 30;
  ```

**Duplicate TLE Parsing Logic:**
- Issue: TLE parsing duplicated across multiple locations
- Files: `src/utils/tleData.js` (lines 15-33 - parseTLEText), `src/services/spaceTrackService.js` (lines 169-194 - parseSpaceTrackData)
- Impact: Bug fixes or format changes must be made in multiple places; inconsistent behavior
- Fix approach: Create single canonical TLE parser in utils, import everywhere needed.

## Performance Bottlenecks

**Web Worker Underutilized:**
- Issue: Worker created but only used for position calculation. Ground track calculation runs on main thread.
- Files: `src/components/SatelliteTracker.jsx` (lines 816-833 worker init, line 935-945 ground track update), `src/workers/satelliteWorker.js`
- Cause: Ground track calculation (calculateGroundTrack, lines 33-64) is synchronous and CPU-intensive (loops up to durationMinutes with high precision). Runs every 5 seconds (line 944).
- Improvement path: Move ground track calculation to web worker. Pass calculation parameters to worker, receive computed points back.

**No Debouncing on Ground Track Updates:**
- Issue: Ground track recalculates every 5 seconds unconditionally (line 944 setInterval)
- Files: `src/components/SatelliteTracker.jsx` (lines 935-951)
- Impact: Continuous DOM updates and re-renders even when ground track display hasn't changed; wastes CPU on invisible updates if panel is collapsed
- Fix approach: Add debounce/throttle. Only recalculate when: (1) selected satellite changed, (2) observer location changed, (3) time has advanced significantly, (4) ground track is actually visible.

**Large Satellite List Rendering:**
- Issue: Can display 100+ satellites (line 121 limit parameter), all rendered in UI list
- Files: `src/components/SatelliteTracker.jsx` (satellite list rendering in return statement)
- Impact: Slow scrolling, high memory usage, DOM thrashing
- Improvement path: Implement virtual scrolling or pagination. Only render visible items.

**Position Updates Every 1 Second (Configurable):**
- Issue: `updateInterval` state (line 626) defaults to 1000ms but drives worker postMessage
- Files: `src/components/SatelliteTracker.jsx` (lines 846 setTimeout with updateInterval)
- Impact: For 100 satellites, this triggers 100 position calculations per second. Memory pressure from continuous allocations.
- Current mitigation: updateInterval is configurable, but no automatic throttling based on FPS
- Improvement path: Tie update frequency to actual observed FPS. If FPS < 30, increase updateInterval automatically.

**PerformanceMonitor Accumulates Data Without Limit:**
- Issue: Metrics arrays have limits (60 FPS samples, 300 memory samples) but operationTimings and customMetrics store up to 100 entries per operation
- Files: `src/utils/performanceMonitor.js` (lines 204, 236)
- Impact: Long sessions accumulate measurement data; unbounded memory growth possible if new operations created dynamically
- Fix approach: Implement circular buffer for all metrics. Cap total metrics size at ~1MB.

## Memory Leaks & Resource Cleanup

**Potential Memory Leak in Ground Track Updates:**
- Issue: updateGroundTrack function (lines 935-951) creates new array every 5 seconds without checking if previous calculation completed
- Files: `src/components/SatelliteTracker.jsx` (lines 935-951)
- Impact: If ground track calculation is slow (>5s), queue builds up, memory pressure increases
- Workaround: None currently
- Fix approach: Track in-flight requests. Skip update if previous hasn't completed. Use AbortController if moving to async worker.

**Long Task Observer Not Cleaned Up Completely:**
- Issue: longTaskObserver created in PerformanceMonitor (lines 56-79) but only disconnected on stop() call
- Files: `src/utils/performanceMonitor.js` (lines 56-79, cleanup at line 477)
- Impact: If module not properly stopped, observer remains active, consuming memory
- Mitigation: Enabled only in development (line 484)
- Fix approach: Add explicit destructor or use WeakMap for singleton instance.

## Fragile Areas

**TLE Validation Too Permissive:**
- Issue: TLE validation only checks line length (line 182-183) but doesn't validate checksum or format integrity
- Files: `src/services/spaceTrackService.js` (lines 182-183)
- Why fragile: Malformed TLE lines that pass length check will cause silent failures in satellite.js
- Safe modification: Add full TLE checksum validation:
  ```javascript
  function validateTLEChecksum(line) {
    let checksum = 0;
    for (let i = 0; i < 68; i++) {
      const c = line[i];
      if (c >= '0' && c <= '9') checksum += parseInt(c);
      else if (c === '-') checksum += 1;
    }
    checksum = checksum % 10;
    return checksum === parseInt(line[68]);
  }
  ```
- Test coverage: No unit tests for TLE parsing/validation

**Error Handling Too Generic:**
- Issue: Catch blocks rethrow errors without context
- Files: `src/services/spaceTrackService.js` (lines 95-98, 112-115, 127-130, 160-163)
- Why fragile: Caller can't distinguish between auth errors, network errors, or malformed responses. All treated identically.
- Safe modification: Create specific error types or include error code/type in thrown error:
  ```javascript
  const error = new Error('API request failed');
  error.code = 'SPACE_TRACK_AUTH_FAILED';
  error.status = response.status;
  throw error;
  ```
- Test coverage: No error scenario tests

**Visibility Calculation Untested:**
- Issue: Complex spherical geometry calculations (lines 67-150 in SatelliteTracker.jsx) with no visible test coverage
- Files: `src/components/SatelliteTracker.jsx` (lines 67-150)
- Why fragile: Small rounding errors propagate through ECEF conversions; edge cases (polar observer, satellite overhead) not obviously handled
- Safe modification: Extract to utility function with unit tests covering: observer at poles, observer at equator, satellite directly overhead, satellite below horizon
- Test coverage: No tests exist

**Y2K Style Epoch Parsing:**
- Issue: TLE epoch parsing uses year pivot at 57 (line 15 in SatelliteTracker.jsx)
- Files: `src/components/SatelliteTracker.jsx` (line 15)
- Why fragile: Hardcoded pivot year assumes YY < 57 means 20YY. Valid until 2057, but brittle.
- Safe modification: Document clearly or use full year from data source. This is upstream data issue from Space-Track.
- Test coverage: No epoch parsing tests

## Scaling Limits

**API Rate Limiting Not Handled:**
- Issue: Space-Track.org has rate limits but client makes requests without backoff or queuing
- Files: `src/services/spaceTrackService.js` (all fetch operations), `src/components/SatelliteTracker.jsx` (loadSatellites calls)
- Current capacity: Unknown; depends on Space-Track.org's tier
- Limit: API likely returns 429 Too Many Requests or 503 Service Unavailable
- Impact: Unhandled 429 appears as generic authentication error
- Scaling path: Implement exponential backoff, request queuing, and 429 status code detection with user feedback.

**Memory Scaling with Satellite Count:**
- Issue: All satellite data held in component state
- Files: `src/components/SatelliteTracker.jsx` (lines 621 satellites state)
- Current capacity: ~1000-2000 satellites before noticeable lag (depends on machine)
- Scaling path: Implement pagination or server-side filtering. Only load satellites matching search criteria.

**Network Requests on Initial Load:**
- Issue: Multiple sequential API calls during setup (getTLEsByNoradIds for popular sats can trigger many requests)
- Files: `src/services/spaceTrackService.js` (lines 224-239)
- Impact: Slow initial load time, multiple browser requests count against rate limit
- Scaling path: Batch requests where API allows. Cache responses with TTL.

## Known Issues

**Unused satelliteCalculations.js:**
- Issue: File exists but is 0 lines (empty or deleted)
- Files: `src/utils/satelliteCalculations.js`
- Impact: Confusion about intended functionality; may be incomplete refactoring
- Fix: Either remove or implement intended functionality

**Deprecated Orbit Controls Prop:**
- Issue: @react-three/drei's OrbitControls API may have breaking changes in minor updates
- Files: `src/components/SatelliteTracker.jsx` (imported from drei)
- Current version: ^10.7.6 (line 13 package.json)
- Impact: Minor version bumps could break control behavior
- Mitigation: Fix major version or document expected drei version

## Test Coverage Gaps

**No Unit Tests Exist:**
- What's not tested: 
  - TLE parsing and validation (`parseSpaceTrackData`, `parseTLEText`)
  - Orbital calculations (ground track, visibility, epoch parsing)
  - Position calculations (worker behavior)
  - Error handling paths
  - Edge cases in math functions
- Files: All core calculation files (`src/utils/`, `src/services/`, `src/workers/`)
- Risk: Silent calculation errors go unnoticed. Refactoring breaks calculations without feedback.
- Priority: High - orbital calculations are safety-critical for accuracy

**No Integration Tests:**
- What's not tested: Authentication flow, satellite loading, position updates
- Risk: Changes to authentication or service layer break the entire app
- Priority: Medium - would catch integration issues early

## Dependencies at Risk

**No Lockfile in Repo (But lockfile exists):**
- Issue: `package-lock.json` exists (good), but not shown as committed in typical git checks
- Risk: Dependency tree may differ between dev and prod if lock isn't kept in sync
- Mitigation: Ensure package-lock.json is committed and CI validates lock integrity

**Three.js and React-Three-Fiber Version Mismatch Risk:**
- Packages: `three: ^0.180.0`, `@react-three/fiber: ^9.4.0`
- Risk: Three.js can have breaking changes in minor versions; react-three-fiber may not support all Three versions
- Current status: Compatible, but tight coupling
- Mitigation: Consider pinning major versions or documenting tested combinations

**No Error Boundary:**
- Issue: No React Error Boundary component; 3D canvas errors crash entire app
- Files: `src/App.jsx`
- Impact: Browser console errors in Canvas or drei components unmount everything
- Fix approach: Wrap Canvas in ErrorBoundary, provide fallback UI

## Security Considerations

**CORS Proxy in Development:**
- Issue: Vite proxy configured for `/api/spacetrack` → `https://www.space-track.org` with credentials forwarding
- Files: `vite.config.js` (lines 10-34)
- Risk: This setup leaks credentials through proxy in development; not suitable for production
- Current mitigation: Only applies to dev server
- Recommendations: 
  - Implement backend proxy for production (Node/Python server that handles Space-Track auth)
  - Never run Vite dev server in production
  - Backend should store Space-Track credentials server-side, frontend gets session tokens

**No HTTPS Enforcement:**
- Issue: Dev proxy and localStorage access to credentials happens over HTTP in development
- Impact: Credentials could be intercepted on local network
- Recommendations: Always use HTTPS in any non-local environment; use localhost-only Vite server

**XSS Vulnerability in Error Display:**
- Issue: Error messages displayed directly without sanitization (visible in UI)
- Files: `src/components/SatelliteTracker.jsx` (error state rendering)
- Risk: If API returns HTML/script in error message, it could execute
- Mitigation: Render error strings in `<p>` or pre-formatted text, not as HTML

---

*Concerns audit: 2026-04-06*
