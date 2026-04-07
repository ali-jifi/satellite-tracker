# Architecture

**Analysis Date:** 2026-04-06

## Pattern Overview

**Overall:** Client-side satellite tracking application with layered component architecture

**Key Characteristics:**
- React-based frontend with Three.js 3D visualization
- Computational work offloaded to Web Workers and async calculations
- Service-oriented pattern for external API integration (Space-Track.org)
- Real-time state management using React hooks
- Performance monitoring baked into the application

## Layers

**Presentation Layer (Components):**
- Purpose: Render UI and 3D graphics, handle user interactions
- Location: `src/components/`
- Contains: React functional components (SatelliteTracker.jsx, PerformanceMonitor.jsx)
- Depends on: Services, utilities, React Three Fiber/Drei
- Used by: React DOM (entry point)
- Pattern: Container component (SatelliteTracker) with embedded 3D scene (Canvas with Earth, Satellite3D subcomponents)

**Service Layer:**
- Purpose: Abstract external API communication and authentication
- Location: `src/services/spaceTrackService.js`
- Contains: SpaceTrackService class for Space-Track.org API interaction
- Depends on: Fetch API, environment configuration
- Used by: Presentation layer for TLE data fetching
- Pattern: Singleton instance exported for global access

**Utility/Calculation Layer:**
- Purpose: Pure mathematical and data transformation functions
- Location: `src/utils/`
- Contains:
  - `tleData.js`: TLE parsing and CelesTrak fetching
  - `performanceMonitor.js`: Performance metrics collection
  - `satelliteCalculations.js`: (Currently empty stub)
- Depends on: satellite.js library for orbital mechanics
- Used by: Components for position calculations

**Worker Layer:**
- Purpose: Offload CPU-intensive satellite calculations from main thread
- Location: `src/workers/satelliteWorker.js`
- Contains: Web Worker for batch satellite position calculation
- Depends on: satellite.js library
- Used by: SatelliteTracker component for parallel computation
- Pattern: Event-based message passing (postMessage/onmessage)

**Entry Point:**
- Location: `src/main.jsx` → `src/App.jsx` → `src/components/SatelliteTracker.jsx`
- Pattern: Simple React bootstrapping, single root component delegates to main tracker

## Data Flow

**Initial Load & Authentication:**
1. SatelliteTracker mounts with location prompt
2. User can authenticate with Space-Track.org credentials via UI dialog
3. spaceTrackService.login() sends credentials to `/api/spacetrack/ajaxauth/login`
4. Upon success, application queries for popular satellites via getTLEsByNoradIds()
5. Satellites populate state and begin tracking

**Real-time Tracking Loop:**
1. SatelliteTracker useEffect initiates animation loop (setupAnimationLoop())
2. Every `updateInterval` ms (default 1000), batch of satellites sent to worker
3. SatelliteWorker (or SatelliteWorker polyfill class) calculates positions in parallel
4. Positions returned via postMessage event
5. Positions state updated, triggering re-render
6. 3D scene updates with new satellite positions
7. Visibility calculations and pass predictions run on selected satellite

**Ground Track Calculation:**
1. User selects a satellite (setSelectedSatellite)
2. calculateGroundTrack() iterates time forward, calculating position at each step
3. Validates each point (finite lat/lon/alt)
4. Returns array of ground track points
5. Points rendered as line on 3D globe (if showGroundTrack enabled)

**Pass Prediction:**
1. User requests upcoming passes for selected satellite
2. predictPasses() simulates 24 hours ahead, checking elevation at each minute
3. Detects pass start (elevation crosses minElevation threshold)
4. Tracks max elevation during pass
5. Detects pass end (elevation drops below threshold)
6. Stores pass data with times, azimuths, durations
7. UI displays upcoming passes in "Passes" tab

**State Management:**
- Component-level state via useState hooks (22+ state variables)
- No global state management (Redux/Context not used)
- Ref-based storage for animation loop and worker references
- Single source of truth per page (SatelliteTracker.jsx)
- Positions stored as object keyed by satellite ID for O(1) lookups

## Key Abstractions

**SatelliteWorker (Polyfill):**
- Purpose: Simulate Web Worker behavior for batch position calculations
- Implementation: `src/components/SatelliteTracker.jsx` lines 188-248
- Pattern: Class with postMessage/onmessage interface matching Web Worker API
- Used when: Native Web Worker unavailable or for development simplicity
- Maps satellite.js propagation across array of TLEs

**Earth Component:**
- Purpose: Render 3D Earth with textures, atmosphere, and observer marker
- Implementation: Functional component returning Three.js geometry (Sphere, mesh materials)
- Uses: react-three-fiber Canvas context, Three.js TextureLoader
- Features: NASA Blue Marble texture, bump mapping, observer location visualization

**Satellite3D Component:**
- Purpose: Render individual satellite with glowing effects
- Implementation: Three.js spheres with multiple layers for glow effects
- Features: Selection-based scale changes, altitude line to Earth surface
- Coordinates: Geodetic (lat/lon/alt) → Spherical → Cartesian conversion

**SpaceTrackService Singleton:**
- Purpose: Centralized API client with authentication state
- Pattern: Single instance exported as default
- Features: Cookie-based auth persistence, query building, TLE parsing/filtering
- Methods: login(), getTLEsByNoradIds(), getTLEsByCategory(), getPopularSatellites()

**PerformanceMonitor Singleton:**
- Purpose: Real-time performance metrics collection
- Implementation: `src/utils/performanceMonitor.js` (483 lines)
- Tracks: FPS, memory usage, operation timings, long tasks
- Exports: Global window.performanceMonitor for debugging

## Entry Points

**Main Web Application:**
- Location: `src/main.jsx`
- Entry: ReactDOM.createRoot(document.getElementById('root')).render(<App />)
- Bootstraps: Single <React.StrictMode> wrapper around <App />
- Loads: Global CSS from `src/index.css`

**SatelliteTracker Component:**
- Location: `src/components/SatelliteTracker.jsx`
- Size: ~1400+ lines
- Responsibilities:
  - State management for all tracking data (satellites, positions, UI state)
  - Animation loop coordination with Web Worker
  - 3D scene rendering via Canvas (React Three Fiber)
  - User interaction handling (search, selection, authentication)
  - Performance monitoring integration
  - Real-time position updates and pass predictions

**Canvas/3D Rendering:**
- Framework: React Three Fiber + Drei
- Entry: `<Canvas>` component wrapping OrbitControls, Earth, Satellite3D instances, Stars
- Triggers: requestAnimationFrame loop in SatelliteTracker
- Outputs: WebGL rendered 3D scene in DOM

## Error Handling

**Strategy:** Defensive programming with validation at calculation boundaries

**Patterns:**

1. **TLE Validation:**
   - Check TLE line lengths (must be exactly 69 chars)
   - Validate parsed satrec objects for parse errors
   - Filter results in spaceTrackService.parseSpaceTrackData()

2. **Position Validation:**
   - Check position objects exist and have no error flags
   - Validate latitude (-90 to 90), longitude (-180 to 180), altitude (>0)
   - Use isFinite() checks before calculations
   - Log warnings for invalid data, return null or skip

3. **API Error Handling:**
   - Try-catch blocks in spaceTrackService methods
   - Status code checks (401/403 for auth, others for request failures)
   - Errors thrown up to component for UI display
   - Component catches and sets error state for user notification

4. **Worker Error Handling:**
   - Try-catch within worker message handler
   - Invalid satellites filtered out (return null, then filter(Boolean))
   - Errors logged to console, position data skipped

5. **Web Requests:**
   - Fetch errors caught and logged
   - No retry logic (single attempt per request)
   - Errors propagate to UI for user acknowledgment

## Cross-Cutting Concerns

**Logging:**
- console.error() for errors (TLE parsing, propagation failures)
- console.warn() for warnings (memory leaks, low FPS, invalid data)
- console.log() for info messages (rare, mostly in PerformanceMonitor)
- No structured logging framework (raw console only)

**Validation:**
- Input validation at service layer (TLE format checks)
- Calculation-time validation (isFinite checks, bounds checks)
- Component-level validation (search term, location inputs)
- No centralized validation utility (scattered throughout code)

**Authentication:**
- Cookie-based auth via Space-Track.org
- Credentials stored in component state (username, password)
- Login state tracked (isAuthenticated boolean)
- No token refresh or session management

**Performance:**
- Real-time FPS and memory monitoring via PerformanceMonitor utility
- Metrics logged to browser console (dev mode only)
- Can export full performance report via window.performanceMonitor.generateReport()
- 3D rendering optimized: Earth 32x32 segments (1024 tris vs 4096 tris for 64x64)

---

*Architecture analysis: 2026-04-06*
