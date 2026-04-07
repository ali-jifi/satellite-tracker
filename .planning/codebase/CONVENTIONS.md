# Coding Conventions

**Analysis Date:** 2026-04-06

## Naming Patterns

**Files:**
- Components: PascalCase with `.jsx` extension (e.g., `SatelliteTracker.jsx`, `PerformanceMonitor.jsx`)
- Utilities: camelCase with `.js` extension (e.g., `satelliteCalculations.js`, `performanceMonitor.js`)
- Services: camelCase with `.js` extension (e.g., `spaceTrackService.js`)
- CSS: match component name (e.g., `App.css`)

**Functions:**
- Regular functions: camelCase (e.g., `parseTLEEpoch`, `calculateGroundTrack`, `getOrbitalPeriod`)
- React hooks: camelCase with "use" prefix (e.g., `useState`, `useEffect`, `useRef`)
- Component names: PascalCase (e.g., `SatelliteTracker`, `PerformanceMonitor`)

**Variables:**
- State variables: camelCase (e.g., `satellites`, `selectedSatellite`, `positions`, `isTracking`)
- Constants: camelCase or UPPER_SNAKE_CASE for module-level constants
  - Module constants: `const SPACE_TRACK_BASE_URL = '/api/spacetrack'`
  - Derived values: `const earthRadius = 6371`
- Boolean variables: prefix with `is`, `has`, `show`, `get`, `can` (e.g., `isTracking`, `isVisible`, `showGroundTrack`, `gettingLocation`)
- Reference variables: suffix with `Ref` for useRef hooks (e.g., `workerRef`, `animationRef`, `frameCountRef`)
- Map/Set variables: clear naming (e.g., `this.callbacks = new Map()`)

**Types:**
- Not using TypeScript - using JSDoc comments for documentation instead

## Code Style

**Formatting:**
- No explicit `.prettierrc` or formatter config - relies on ESLint
- Uses consistent spacing and indentation across files
- Line continuations use standard JS conventions

**Linting:**
- Tool: ESLint v9.36.0
- Config: `eslint.config.js` using flat config format
- Key settings:
  - `ecmaVersion: 2020` with `sourceType: 'module'` for modern JS
  - Supports JSX via `ecmaFeatures: { jsx: true }`
  - Browser globals enabled
  - Extends: `js.configs.recommended`, `reactHooks.configs['recommended-latest']`, `reactRefresh.configs.vite`
  - Custom rule: `no-unused-vars` ignores pattern `^[A-Z_]` (uppercase/underscore prefixed)

**Build/Dev:**
- Vite v7.1.7 for bundling and development
- React v19.1.1 with fast refresh
- Tailwind CSS v3.4.18 for styling
- No TypeScript - pure JavaScript/JSX

## Import Organization

**Order:**
1. React and React-DOM imports
2. Third-party UI/graphics libraries (@react-three/*, lucide-react, three)
3. Satellite computation libraries (satellite.js)
4. Local imports (services, components, utils)

**Path Aliases:**
- Relative imports using `../` paths (e.g., `../services/spaceTrackService`, `../components/PerformanceMonitor`)
- No path aliases configured in vite or eslint

**Example:**
```jsx
import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Satellite, Search } from 'lucide-react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Sphere, Stars } from '@react-three/drei';
import * as THREE from 'three';
import * as satellite from 'satellite.js';
import spaceTrackService from '../services/spaceTrackService';
import PerformanceMonitor from './PerformanceMonitor';
```

## Error Handling

**Patterns:**
- Try-catch blocks for async operations and API calls
- Explicit error logging with `console.error()` before re-throwing or handling
- Descriptive error messages for user-facing scenarios (e.g., "Authentication failed. Please check your credentials.")
- Input validation checks before processing (e.g., checking for `null`/`undefined`, type validation)
- Safe property access with checks like `isFinite()`, `Array.isArray()`, type checks

**Examples from codebase:**
```javascript
// Service class method error handling
async login() {
  if (!this.username || !this.password) {
    throw new Error('Space-Track credentials not set. Please set credentials first.');
  }
  
  try {
    const response = await fetch(authUrl, { ... });
    if (!response.ok) {
      throw new Error('Authentication failed. Please check your username and password.');
    }
    return true;
  } catch (error) {
    console.error('Space-Track authentication failed:', error);
    throw new Error('Authentication failed. Please check your credentials.');
  }
}

// Validation before processing
if (!satPos || !isFinite(satPos.latitude) || !isFinite(satPos.longitude)) {
  console.error('Invalid satellite position:', satPos);
  return { range: 0, elevation: -90, azimuth: 0, isVisible: false };
}
```

## Logging

**Framework:** `console` methods (`console.error`, `console.warn`, `console.log`)

**Patterns:**
- `console.error()` for error conditions and caught exceptions
- `console.warn()` for validation warnings or edge cases (e.g., invalid TLE data, stale TLE epochs)
- `console.log()` for informational messages (e.g., startup messages like loaded satellite counts)
- Include context in error logs (e.g., satellite name, operation name)
- Include relevant values in messages (e.g., status codes, coordinate values)

**Examples:**
```javascript
console.error('Invalid satellite position:', satPos);
console.warn(`Invalid ground track point at time ${time.toISOString()}: lat=${latitude}, lon=${longitude}, alt=${altitude}`);
console.log(`loaded ${validSatellites.length}/${satelliteData.length} sats (filtered ${satelliteData.length - validSatellites.length} invalid tles)`);
```

## Comments

**When to Comment:**
- Inline comments for complex calculations or non-obvious logic
- Block comments (single `//` style) for algorithm explanations
- Brief inline comments on the same line as code for clarity
- No extensive documentation - prefer clear variable/function names

**JSDoc/Docstrings:**
- Used for class methods and public functions
- Minimal format: `/** comment text */`
- Example from codebase:
  ```javascript
  /**
   * set creds for Space-Track.org auth
   */
  setCredentials(username, password) { ... }
  
  /**
   * @param {Array} noradIds NORAD catalog ids array
   */
  async getTLEsByNoradIds(noradIds) { ... }
  ```

## Function Design

**Size:** Functions are moderate to large when needed for logic clarity
- Utility functions often contain complete algorithms (e.g., `calculateVisibility` spans 80+ lines)
- Component functions can be very large (e.g., `SatelliteTracker` is 1803 lines)
- Complex logic kept in single function scope rather than further decomposed

**Parameters:**
- Positional parameters for required inputs
- Default parameters used (e.g., `step = 1`, `observerAlt = 0`, `minElevation = 10`)
- Destructuring used for complex data (state updates)

**Return Values:**
- Explicit returns for computed values
- Null/null returns used when unable to compute (e.g., `.filter(Boolean)` to remove nulls)
- Objects returned for multiple values (e.g., visibility calculation returns `{ range, elevation, azimuth, isVisible }`)

## Module Design

**Exports:**
- Single default export per file for components: `export default ComponentName`
- Single default export for service singletons: `export default spaceTrackService`
- Named exports for utility functions: `export function functionName() { ... }`
- Mix of named and default exports in utility modules

**Barrel Files:**
- Not used in this codebase

**Class Design:**
- Singleton service classes (e.g., `SpaceTrackService` instantiated once and exported)
- Private state in constructor (e.g., `this.username`, `this.password`)
- Public methods on service classes
- No inheritance chains

---

*Convention analysis: 2026-04-06*
