# Testing Patterns

**Analysis Date:** 2026-04-06

## Test Framework

**Runner:**
- Not detected - no test framework installed or configured

**Assertion Library:**
- Not detected

**Run Commands:**
- No test commands configured in `package.json`
- `package.json` scripts: `dev`, `build`, `lint`, `preview`

**Status:**
This codebase currently has no automated testing infrastructure. The lint command runs ESLint but does not run any test suites.

## Test File Organization

**Location:**
- Not applicable - no test files found

**Naming:**
- Not applicable - no test file naming convention established

**Structure:**
- Not applicable - no tests present

---

## Test Structure

No test files are present in the codebase. Example structure from typical React projects would be:

```
src/
├── components/
│   ├── SatelliteTracker.jsx
│   └── SatelliteTracker.test.jsx
├── services/
│   ├── spaceTrackService.js
│   └── spaceTrackService.test.js
└── utils/
    ├── satelliteCalculations.js
    └── satelliteCalculations.test.js
```

However, this structure is not currently implemented.

## Mocking

**Framework:**
- Not detected

**Patterns:**
- Not applicable

**What to Mock (if testing were implemented):**
- API calls to Space-Track.org (via `spaceTrackService`)
- Fetch requests for TLE data
- Web Worker operations (currently uses fallback `SatelliteWorker` class)
- `navigator.geolocation` for location features
- `performance.memory` for performance monitoring
- Three.js rendering operations

**What NOT to Mock (if testing were implemented):**
- Core `satellite.js` calculations (test against known ephemeris values)
- Mathematical utility functions (`calculateVisibility`, `calculateGroundTrack`)
- TLE parsing logic (use real TLE data samples)

## Fixtures and Factories

**Test Data:**
- Not applicable - no test data structures created

**Location:**
- Not applicable

**Suggested approach (if testing were implemented):**
- Create sample TLE data fixtures from the format:
  ```javascript
  // Example TLE fixture
  {
    id: 25544,
    name: 'ISS',
    tle1: '1 25544U 98067A   23123.00000000  .00010270  00000-0  18814-3 0  9995',
    tle2: '2 25544  51.6417 208.2027 0011149 303.6373 201.5847 15.54043851396887',
    category: 'station'
  }
  ```

## Coverage

**Requirements:**
- Not enforced - no coverage configuration present

**View Coverage:**
- Not applicable - no test framework configured

**Suggested setup (if implementing tests):**
```bash
# Would need to install test framework first
npm install --save-dev vitest @vitest/ui
npm run test:coverage
```

## Test Types

**Unit Tests:**
- Not yet implemented
- Should test: utility functions (`calculateVisibility`, `calculateGroundTrack`, `parseTLEText`), service methods
- Recommended framework: Vitest (fast, Vite-native)

**Integration Tests:**
- Not yet implemented
- Should test: API interactions with Space-Track.org, TLE fetching pipelines, component state management
- Could use MSW (Mock Service Worker) for API mocking

**E2E Tests:**
- Not yet implemented
- Not configured - no framework present

## Common Patterns

**Async Testing:**
- Not yet implemented
- Example pattern to use (with Vitest):
  ```javascript
  describe('spaceTrackService', () => {
    it('should fetch TLEs by NORAD IDs', async () => {
      const mockData = [{ /* TLE data */ }];
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData)
      });
      
      const result = await spaceTrackService.getTLEsByNoradIds([25544]);
      expect(result).toEqual(expect.any(Array));
    });
  });
  ```

**Error Testing:**
- Not yet implemented
- Example pattern (with Vitest):
  ```javascript
  it('should throw error when credentials not set', async () => {
    await expect(spaceTrackService.login())
      .rejects
      .toThrow('Space-Track credentials not set');
  });
  ```

## Critical Components to Test

**High Priority (core functionality):**
- `parseTLEText()` in `src/utils/tleData.js` - TLE parsing logic
- `calculateVisibility()` in `src/components/SatelliteTracker.jsx` - visibility calculations
- `calculateGroundTrack()` in `src/components/SatelliteTracker.jsx` - ground track computation
- `spaceTrackService` methods in `src/services/spaceTrackService.js` - API interactions

**Medium Priority (utility functions):**
- `performanceMonitor.js` - performance tracking utilities
- Coordinate conversion functions in `SatelliteTracker.jsx`

**Lower Priority (UI components):**
- `SatelliteTracker.jsx` component - complex but heavily dependent on external data
- `PerformanceMonitor.jsx` - display component

## Recommended Test Setup

To implement testing in this codebase, follow these steps:

1. Install Vitest and related tools:
   ```bash
   npm install --save-dev vitest @vitest/ui happy-dom
   ```

2. Create `vitest.config.js`:
   ```javascript
   import { defineConfig } from 'vitest/config';
   import react from '@vitejs/plugin-react';
   
   export default defineConfig({
     plugins: [react()],
     test: {
       globals: true,
       environment: 'happy-dom',
       coverage: {
         provider: 'v8',
         reporter: ['text', 'json', 'html']
       }
     }
   });
   ```

3. Add test scripts to `package.json`:
   ```json
   "scripts": {
     "test": "vitest",
     "test:ui": "vitest --ui",
     "test:coverage": "vitest --coverage"
   }
   ```

4. Create test files colocated with source files (e.g., `satelliteCalculations.test.js` next to `satelliteCalculations.js`)

---

*Testing analysis: 2026-04-06*
