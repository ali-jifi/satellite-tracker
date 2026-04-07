# Technology Stack

**Analysis Date:** 2026-04-06

## Languages

**Primary:**
- JavaScript (ES2020+) - All source code, React components, utilities
- JSX - React components in `src/components/` and `src/App.jsx`

**Build/Config:**
- JavaScript - Configuration files (vite.config.js, tailwind.config.js, eslint.config.js, postcss.config.js)

## Runtime

**Environment:**
- Node.js 20.19.5+ (development)
- Browser (production) - Modern browsers with ES2020 support

**Package Manager:**
- npm 10.8.2+
- Lockfile: `package-lock.json` (v3, present)

## Frameworks

**Core:**
- React 19.1.1 - UI framework, component-based architecture
- Vite 7.1.7 - Build tool and development server with HMR
- @vitejs/plugin-react 5.0.4 - React plugin for Vite

**3D Graphics:**
- Three.js 0.180.0 - 3D graphics library for WebGL rendering
- @react-three/fiber 9.4.0 - React renderer for Three.js
- @react-three/drei 10.7.6 - Useful helpers and components for React Three Fiber (Stars, OrbitControls, Sphere components)

**Styling:**
- Tailwind CSS 3.4.18 - Utility-first CSS framework
- PostCSS 8.5.6 - CSS transformation tool
- autoprefixer 10.4.21 - Vendor prefixing for CSS

**UI Components:**
- lucide-react 0.546.0 - Icon library (MapPin, Satellite, Search, Settings, RefreshCw, Eye, Navigation, Clock, Target, Key, Menu, X, ChevronRight, Radio, Crosshair, Gauge, Layers)

## Key Dependencies

**Critical:**
- satellite.js 6.0.1 - SGP4/SDP4 satellite propagation algorithms for orbit calculations, TLE parsing, and position computation

**Utilities:**
- None (no major utility libraries like lodash, moment, axios detected)

## Development Dependencies

**Linting & Code Quality:**
- ESLint 9.36.0 - JavaScript linter
- @eslint/js 9.36.0 - ESLint recommended JavaScript config
- eslint-plugin-react-hooks 5.2.0 - ESLint rules for React Hooks
- eslint-plugin-react-refresh 0.4.22 - Enforces React Fast Refresh rules
- globals 16.4.0 - Global variable definitions

**Type Support:**
- @types/react 19.1.16 - TypeScript definitions for React
- @types/react-dom 19.1.9 - TypeScript definitions for React DOM

## Configuration

**Environment:**
- `.env` file present (contains environment variables)
- Vite environment variables use `import.meta.env` prefix
- Required env vars:
  - `VITE_SPACETRACK_USERNAME` - Space-Track.org account username
  - `VITE_SPACETRACK_PASSWORD` - Space-Track.org account password
  - `DEV` - Automatically set by Vite in development mode

**Build Configuration:**
- `vite.config.js` - Vite build config with React plugin and dev proxy configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS config with Tailwind and autoprefixer
- `eslint.config.js` - ESLint configuration with React and React Hooks rules

**Build Output:**
- `dist/` - Production build directory (gitignored)
- `node_modules/` - Dependencies (gitignored)

## Vite Configuration Details

**Proxy Setup:**
- `/api/spacetrack` routes proxied to `https://www.space-track.org` (development only)
- CORS handling via proxy headers (User-Agent, Cookie forwarding)
- Web worker format: ES modules

**Entry Points:**
- `index.html` - HTML entry point
- `src/main.jsx` - JavaScript entry point

## Platform Requirements

**Development:**
- Node.js 16+ (stated in README, 20.19.5 in use)
- npm (no yarn/pnpm lock files detected)
- Modern browser with ES2020 support for development
- Free Space-Track.org account (signup required)

**Production:**
- Static hosting capable of serving SPA (Vercel, Netlify, S3+CloudFront, etc.)
- No backend server required (frontend-only application)
- Proxy configuration needed for Space-Track.org API calls (or configure CORS elsewhere)

## Deployment Considerations

**Build Command:**
```bash
npm run build
```

**Dev Command:**
```bash
npm run dev
```

**Preview Command:**
```bash
npm run preview
```

**Lint Command:**
```bash
npm run lint
```

**Output:**
- Single Page Application (SPA) with JavaScript and asset files in `dist/`
- No server-side rendering

## Special Notes

**Vite Worker Configuration:**
- Workers configured to use ES module format (`worker: { format: 'es' }`)
- Satellite calculations run in Web Worker (`src/workers/satelliteWorker.js`)

**Development Proxy:**
- Vite proxy handles CORS issues during development for Space-Track.org API
- Proxy re-routes `/api/spacetrack/*` requests to `https://www.space-track.org/*`
- Cookie handling enabled for authentication flow

---

*Stack analysis: 2026-04-06*
