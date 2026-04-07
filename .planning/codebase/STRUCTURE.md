# Codebase Structure

**Analysis Date:** 2026-04-06

## Directory Layout

```
satellite-tracker/
├── src/
│   ├── components/           # React UI components
│   │   ├── SatelliteTracker.jsx     # Main tracking component (1400+ lines)
│   │   └── PerformanceMonitor.jsx   # Real-time metrics display
│   ├── services/             # External API clients
│   │   └── spaceTrackService.js     # Space-Track.org API wrapper
│   ├── utils/                # Utility functions and helpers
│   │   ├── tleData.js               # TLE parsing/fetching
│   │   ├── performanceMonitor.js    # Performance metrics collection
│   │   └── satelliteCalculations.js # (Stub file, unused)
│   ├── workers/              # Web Worker code
│   │   └── satelliteWorker.js       # Parallel satellite calculations
│   ├── assets/               # Static assets
│   │   └── react.svg
│   ├── App.jsx               # Root app component
│   ├── App.css               # App styling
│   ├── main.jsx              # React bootstrap entry point
│   └── index.css             # Global styles (Tailwind)
├── public/                   # Static files served as-is
├── dist/                     # Built output (production)
├── index.html                # HTML template entry point
├── package.json              # Dependencies and scripts
├── package-lock.json         # Lockfile
├── vite.config.js            # Vite build configuration
├── eslint.config.js          # ESLint rules
├── tailwind.config.js        # Tailwind CSS configuration
├── postcss.config.js         # PostCSS configuration
└── .env                      # Environment variables (secrets)
```

## Directory Purposes

**src/**
- Purpose: All application source code
- Contains: React components, business logic, utilities, workers
- Key files: `SatelliteTracker.jsx` (main component), `spaceTrackService.js` (API client)

**src/components/**
- Purpose: Reusable and page-level React components
- Contains: Functional components with hooks
- Key files:
  - `SatelliteTracker.jsx`: Single page app, container for entire tracking interface
  - `PerformanceMonitor.jsx`: Overlay displaying real-time metrics

**src/services/**
- Purpose: External service clients and API wrappers
- Contains: Business logic for API communication
- Key files: `spaceTrackService.js` (singleton for Space-Track.org)

**src/utils/**
- Purpose: Pure utility functions and helpers
- Contains: Math calculations, data transformations, monitoring
- Key files:
  - `tleData.js`: TLE fetching from CelesTrak and Space-Track.org
  - `performanceMonitor.js`: Metrics collection (FPS, memory, operations)
  - `satelliteCalculations.js`: Empty stub for future orbital math

**src/workers/**
- Purpose: Web Worker scripts for parallel computation
- Contains: Worker message handlers
- Key files: `satelliteWorker.js` (batch satellite position calculation)

**src/assets/**
- Purpose: Static assets bundled with application
- Contains: Images, SVGs
- Note: Minimal use; earth textures loaded from CDN (NASA, GitHub raw)

## Key File Locations

**Entry Points:**
- `index.html`: HTML template, sets root div for React
- `src/main.jsx`: React bootstrap (ReactDOM.createRoot)
- `src/App.jsx`: Top-level app component (delegates to SatelliteTracker)
- `src/components/SatelliteTracker.jsx`: Main application logic and UI

**Configuration:**
- `vite.config.js`: Build tool config, proxy setup for Space-Track.org API
- `eslint.config.js`: JavaScript linting rules
- `tailwind.config.js`: Tailwind CSS theming
- `postcss.config.js`: PostCSS (Tailwind) processing
- `package.json`: Project metadata, dependencies, scripts

**Core Logic:**
- `src/components/SatelliteTracker.jsx`: State management, animation loop, calculations
- `src/services/spaceTrackService.js`: API client for TLE data
- `src/utils/tleData.js`: TLE parsing and CelesTrak integration
- `src/utils/performanceMonitor.js`: Performance metrics system
- `src/workers/satelliteWorker.js`: Parallel position calculation (or polyfill)

**Testing:**
- Not found - no test files present (.test.js, .spec.js)

**Styling:**
- `src/index.css`: Global styles (imports Tailwind)
- `src/App.css`: App-level styling (minimal)
- Tailwind: Configuration in `tailwind.config.js`

## Naming Conventions

**Files:**
- Components: PascalCase with .jsx extension (e.g., `SatelliteTracker.jsx`)
- Services: camelCase with .js extension (e.g., `spaceTrackService.js`)
- Utilities: camelCase with .js extension (e.g., `performanceMonitor.js`)
- Workers: camelCase with .js extension (e.g., `satelliteWorker.js`)
- Config files: camelCase with dot-prefixed config name (e.g., `vite.config.js`, `eslint.config.js`)

**Directories:**
- Feature/domain directories: lowercase plural (e.g., `components`, `services`, `utils`, `workers`)
- No nesting deeper than 2 levels within src/

**Functions:**
- Utility functions: camelCase (e.g., `calculateVisibility()`, `predictPasses()`, `parseTLEText()`)
- React components: PascalCase (e.g., `SatelliteTracker`, `Earth`, `Satellite3D`)
- Helper functions: camelCase with descriptive names (e.g., `propagateSatellite()`, `getOrbitalPeriod()`)

**Variables:**
- State variables: camelCase (e.g., `satellites`, `selectedSatellite`, `isTracking`)
- Constants: UPPER_SNAKE_CASE (e.g., `SPACE_TRACK_BASE_URL`)
- DOM/Three.js refs: camelCase with "Ref" suffix (e.g., `workerRef`, `animationRef`)

**Types/Interfaces:**
- No TypeScript - all vanilla JavaScript
- Object keys match API responses (e.g., NORAD_CAT_ID from Space-Track.org API)

## Where to Add New Code

**New Feature (e.g., satellite filtering by altitude):**
- Primary code: `src/components/SatelliteTracker.jsx` (state + UI logic)
- Helpers: `src/utils/` (pure math if needed)
- Tests: Create `src/components/SatelliteTracker.test.js` (currently no test setup)

**New Component (e.g., SatelliteList, OrbitVisualization):**
- Implementation: `src/components/NewComponentName.jsx`
- Props interface: Document in component comments (no PropTypes/TypeScript)
- Styling: Use Tailwind classes inline, no CSS modules
- Dependency: Import from `src/components/` in SatelliteTracker.jsx

**New Service (e.g., WeatherService, NotamService):**
- Implementation: `src/services/newService.js`
- Pattern: Singleton class exported as default (match spaceTrackService pattern)
- Auth: Store credentials in component state, pass to service methods
- API: Use fetch() with vite proxy if needed (update vite.config.js)

**New Utility (e.g., coordinate conversion, data formatting):**
- Implementation: `src/utils/functionName.js`
- Pattern: Pure functions, no side effects
- Export: Named exports for utilities, default for singletons
- Usage: Import in components or other utilities as needed

**New Worker (e.g., GroundTrackWorker for batch ground track calculation):**
- Implementation: `src/workers/groundTrackWorker.js`
- Pattern: Event handler `self.onmessage = function(e) { ... self.postMessage(...) }`
- Reference: Update SatelliteTracker to new worker path in workerRef.current
- Fallback: Implement polyfill class in component if native worker unavailable

**Styling:**
- Global styles: `src/index.css` (import Tailwind, define CSS variables)
- Component styles: Inline Tailwind classes (no scoped CSS modules)
- Theme colors: Configure in `tailwind.config.js`
- Example: `<div className="bg-slate-900 text-white p-4 rounded-lg">`

## Special Directories

**dist/**
- Purpose: Production build output
- Generated: Yes (by `npm run build` with Vite)
- Committed: No (.gitignore)
- Contents: Minified JS, CSS, HTML bundles
- Deployment: Serve contents from static file host

**node_modules/**
- Purpose: npm package dependencies
- Generated: Yes (by `npm install`)
- Committed: No (.gitignore)
- Contents: All third-party packages
- Use: Never edit directly, update via package.json

**.planning/codebase/**
- Purpose: GSD analysis documents
- Generated: Yes (by gsd:map-codebase orchestrator)
- Committed: Yes
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md
- Use: Reference for code generation tasks

**.claude/**
- Purpose: Claude workspace metadata
- Generated: Yes (by Claude IDE)
- Committed: Typically no
- Contents: Session state, tool outputs
- Use: For IDE workflow only

**public/**
- Purpose: Static assets served verbatim (no bundling)
- Generated: No (manually created)
- Committed: Yes
- Contents: Favicon, static resources
- Use: Put assets here that bypass Vite bundling

## Build & Development Flow

**Development:**
```bash
npm run dev          # Vite dev server with HMR
                     # Proxy: /api/spacetrack → https://www.space-track.org
                     # PerformanceMonitor enabled by default
                     # Serves on http://localhost:5173
```

**Production:**
```bash
npm run build        # Vite build to dist/
npm run preview      # Preview built output locally
```

**Linting:**
```bash
npm run lint         # ESLint check src/ and config files
```

**Entry Point Flow:**
1. Browser loads `index.html`
2. Script tag loads `src/main.jsx` as module
3. React mounts to `#root` div
4. `<App />` renders single `<SatelliteTracker />` component
5. SatelliteTracker initializes state, loads satellites, starts animation loop
6. Canvas renders 3D scene, UI renders sidebar, controls, modals

---

*Structure analysis: 2026-04-06*
