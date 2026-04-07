# Satellite Tracker

## What This Is

A feature-rich, real-time satellite tracking web application aiming for feature parity with satellitemap.space. It visualizes tens of thousands of satellites on an interactive 3D globe with multiple camera modes, time controls, constellation tracking, orbital analysis tools, and browser notifications — all running client-side in the browser. Desktop-focused.

## Core Value

Users can explore and track any satellite in real-time on a beautiful, performant 3D globe — from casual browsing to serious orbital analysis.

## Requirements

### Validated

- ✓ 3D globe with satellite visualization — existing
- ✓ Real-time satellite position tracking via SGP4 propagation — existing
- ✓ Ground track calculation and visualization — existing
- ✓ Visibility circle display — existing
- ✓ Pass prediction algorithm — existing
- ✓ Elevation/azimuth calculation for selected satellites — existing
- ✓ Space-Track.org API integration with authentication — existing
- ✓ Browser geolocation support — existing
- ✓ Satellite search by name — existing
- ✓ Category-based satellite browsing — existing
- ✓ Performance monitoring — existing

### Active

**Globe & Visualization:**
- [ ] Migrate from Three.js/R3F to CesiumJS for native geospatial support
- [ ] Day/night terminator with accurate sun position
- [ ] Cloud overlay layer from real satellite imagery
- [ ] Dark minimal globe style (black surface, glowing neon coastlines/borders)
- [ ] Toggle between map styles (photo earth, day/night, dark minimal)
- [ ] Atmosphere and cloud layer toggles
- [ ] GPU instanced rendering for 30k+ satellites at 60fps
- [ ] Space debris as a toggleable layer (dim dots, separate from active satellites)
- [ ] Satellite labels toggle on 3D view
- [ ] Orbit lines and ground tracks toggle

**Camera & Viewpoints:**
- [ ] Follow-cam mode (camera locks onto satellite, orbits with it, looking down)
- [ ] First-person POV mode (riding the satellite, Earth passing below)
- [ ] Ground observer mode (from user's location, looking up at sky dome)
- [ ] Ground observer: satellites as moving dots with labels on sky dome
- [ ] Ground observer: real star background for orientation
- [ ] Ground observer: horizon compass (N/S/E/W) and elevation grid
- [ ] Ground observer: prediction overlay (dashed path for next few minutes)

**Time Controls:**
- [ ] Play/pause current time
- [ ] Rewind time
- [ ] Fast-forward speed controls (2x/4x/8x)
- [ ] Shareable time state in URL

**Data & Sources:**
- [ ] CelesTrak as default data source (no auth required)
- [ ] Space-Track.org as optional power-user data source
- [ ] Background polling for TLE updates (every few hours)
- [ ] Full active satellite catalog (10k+ from CelesTrak)
- [ ] Debris catalog as toggleable dataset

**Search & Browse:**
- [ ] Fuzzy search by name and NORAD ID
- [ ] Browse by category (stations, Starlink, weather, GPS, science, debris)
- [ ] Browse by country/operator
- [ ] Click satellite directly on globe to select it

**Satellite Detail Panel:**
- [ ] Orbit data: altitude, inclination, period, eccentricity, apogee/perigee
- [ ] Object info: launch date, country, operator, purpose, RCS size
- [ ] Live telemetry: current lat/lon/alt, velocity, next pass
- [ ] Visual tools: ground track, visibility footprint, orbit viz, POV mode button

**Constellation Tracking:**
- [ ] Live constellation status (active/decayed/deorbiting counts, coverage stats)
- [ ] Constellation orbit view (visualize all orbital planes on globe)
- [ ] Growth charts (constellation size over time)

**Calculators & Tools:**
- [ ] Re-entry predictor (track satellites about to de-orbit, predicted location/time)
- [ ] TLE analyzer (inspect orbit parameters, epoch age, decay rate)
- [ ] Close approach detector (on-demand: pick a satellite, find what passes near it in 24h)
- [ ] Photobomb simulator (predict satellite transits across Moon/Sun/planets; both warning and planning modes)

**Notifications:**
- [ ] Browser notifications for upcoming passes of tracked satellites
- [ ] Re-entry alerts for satellites predicted to re-enter soon
- [ ] Close approach alerts for tracked satellites

**UI/UX:**
- [ ] Hamburger menu for categories, tools, settings (globe stays clean)
- [ ] Glassmorphism floating panels with the current dark space aesthetic
- [ ] Keyboard shortcuts (spacebar for search, hotkeys for tools)
- [ ] Shareable URLs for specific satellites (e.g. /satellite/25544)
- [ ] Bookmarks/favorites system for frequently tracked satellites
- [ ] Dark/light theme toggle

### Out of Scope

- Mobile/responsive design — desktop only, not worth the complexity for v1
- Real-time chat or social features — not a social platform
- User accounts/backend — everything runs client-side, localStorage for preferences
- Native mobile app — web only
- Live video feeds — not core to tracking
- Multi-language support — English only for v1
- Launch history timeline — nice but not core to tracking functionality

## Context

- Existing codebase uses React 19 + Three.js/R3F + satellite.js + Tailwind CSS
- Major migration to CesiumJS planned — CesiumJS has built-in globe, time system, 3D tiles, and handles geospatial natively
- satellite.js will be retained for SGP4 propagation calculations
- CelesTrak provides free, no-auth access to GP element sets for 10k+ active satellites
- Space-Track.org requires free account but has richer metadata (launch info, decay predictions, RCS)
- satellitemap.space is the primary design/feature reference
- Current UI was recently redesigned with glassmorphism floating panels — this aesthetic direction carries forward
- GPU instancing is critical for rendering 30k+ objects — CesiumJS supports this via point primitives and entity clustering

## Constraints

- **Tech stack**: CesiumJS replaces Three.js/R3F for the globe; React stays for UI components; satellite.js stays for propagation
- **Performance**: Must maintain 60fps with 30k+ satellites visible — GPU instancing required
- **Client-side only**: No backend server; all computation in browser; data fetched from public APIs
- **Desktop only**: No mobile optimization required
- **Data sources**: CelesTrak (primary, free) and Space-Track.org (optional, free account)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Migrate to CesiumJS | Purpose-built for geospatial 3D globes, handles time natively, used by NASA/ESA, better performance for large satellite counts | — Pending |
| CelesTrak as default data source | No authentication required, good data quality/quantity, lower friction for users | — Pending |
| Desktop only | Avoids complexity of responsive design, allows full use of screen real estate for 3D visualization | — Pending |
| GPU instancing for satellites | Only viable approach for rendering 30k+ objects at 60fps in browser | — Pending |
| Client-side only architecture | No server costs, simpler deployment, all computation in browser | — Pending |

---
*Last updated: 2026-04-07 after initialization*
