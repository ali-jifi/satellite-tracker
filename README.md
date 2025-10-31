# 3D Satellite Tracker

A real-time 3D satellite tracking application that displays satellites orbiting Earth using real data from Space-Track.org.

![Satellite Tracker Screenshot](screenshot.png)

## Features

### Real-Time 3D Visualization
- **True 3D rendering** using Three.js and React Three Fiber
- Interactive 3D Earth with atmosphere effects
- Satellites positioned in real 3D space around Earth
- Smooth orbital animations with configurable update rates
- Starfield background with 5000+ stars

### Real Satellite Data
- **Space-Track.org integration** for authentic TLE data
- Real-time satellite position calculations using SGP4 propagation
- Support for multiple data sources:
  - Popular satellites (ISS, Hubble, Tiangong, etc.)
  - Category filtering (Starlink, Weather, Navigation, Space Stations)
  - All active satellites (100+ satellites)

### Advanced Tracking Features
- **Ground Track Visualization**: See the satellite's path over Earth
- **Pass Predictions**: Calculate when satellites will be visible from your location
- **Visibility Analysis**: Real-time elevation, azimuth, and range calculations
- **Observer Location**: Customizable ground station location
- **Orbit Classification**: Automatic LEO/MEO/GEO classification

### Interactive 3D Controls
- **Orbit Camera**: Rotate around Earth with mouse/touch
- **Pan & Zoom**: Navigate the 3D space freely
- **Satellite Selection**: Click to select and track specific satellites
- **Multiple Views**: Tracking, Passes, and Visibility tabs

## Getting Started

### Prerequisites
- Node.js 16+ and npm
- A free Space-Track.org account ([Sign up here](https://www.space-track.org/auth/createAccount))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/satellite-tracker.git
cd satellite-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

### First-Time Setup

#### Quick Setup (Recommended)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Space-Track.org credentials:
   ```
   VITE_SPACETRACK_USERNAME=your_username
   VITE_SPACETRACK_PASSWORD=your_password
   ```

3. Reload the page - the app will automatically authenticate!

#### Alternative: Manual Login

1. When you first open the application, a login dialog will appear
2. Enter your Space-Track.org username and password
3. Click "Sign In" to authenticate
4. The app will fetch real satellite data and display them in 3D

See [SPACE_TRACK_SETUP.md](SPACE_TRACK_SETUP.md) for detailed setup instructions.

## Usage

### 3D Navigation
- **Left Click + Drag**: Rotate the view around Earth
- **Right Click + Drag**: Pan the camera
- **Scroll Wheel**: Zoom in/out

### Selecting Satellites
- Click on a satellite name in the sidebar to select it
- Selected satellites are highlighted in the 3D view
- View detailed information, ground tracks, and pass predictions

### Data Sources
Open Settings to choose your data source:
- **Popular Satellites**: Curated list of interesting satellites
- **By Category**: Filter by satellite type (Starlink, Weather, etc.)
- **All Active**: Display all active satellites (up to 100)

### Performance Settings
- Adjust update interval (500ms - 5000ms)
- Toggle ground tracks and visibility circles
- Control rendering performance

## Tech Stack

- **Frontend Framework**: React 19 + Vite
- **3D Rendering**: Three.js + React Three Fiber + Drei
- **Satellite Calculations**: satellite.js (SGP4 propagation)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Data Source**: Space-Track.org API

## Project Structure

```
satellite-tracker/
├── src/
│   ├── components/
│   │   └── SatelliteTracker.jsx    # Main component
│   ├── services/
│   │   └── spaceTrackService.js    # Space-Track API integration
│   ├── App.jsx
│   └── main.jsx
├── SPACE_TRACK_SETUP.md             # Detailed setup guide
└── README.md
```

## API Integration

This application uses the Space-Track.org API to fetch real TLE (Two-Line Element) data. Space-Track.org is the official source for satellite tracking data maintained by the U.S. Space Force.

**Rate Limits:**
- 300 requests per hour
- 30 requests per minute

The application automatically manages API calls to stay within limits.

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Troubleshooting

### Authentication Issues
- Verify your Space-Track.org account is approved
- Check username and password are correct
- Clear browser cache and try again

### No Satellites Appearing
- Ensure you're authenticated (green indicator in header)
- Check browser console for errors
- Try selecting a different data source

### Performance Issues
- Reduce the number of satellites
- Increase the update interval
- Disable ground tracks for better performance

See [SPACE_TRACK_SETUP.md](SPACE_TRACK_SETUP.md) for more troubleshooting tips.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Acknowledgments

- [Space-Track.org](https://www.space-track.org) for providing free access to satellite TLE data
- [satellite.js](https://github.com/shashwatak/satellite-js) for SGP4 propagation calculations
- [Three.js](https://threejs.org) and [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) for 3D rendering
- U.S. Space Force for maintaining the satellite catalog

## Contact

For questions or support, please open an issue on GitHub.
