import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import * as satellite from 'satellite.js';
import useAppStore from '../../stores/appStore';
import useSatelliteStore from '../../stores/satelliteStore';

const RAD2DEG = 180 / Math.PI;

/**
 * CameraManager -- imperative component managing camera mode transitions.
 *
 * Subscribes to cameraMode from appStore and detailSatelliteId from satelliteStore.
 * Manages follow-cam (lookAtTransform + HeadingPitchRange) and POV (setView per tick).
 * Renders HUD overlay for POV mode.
 */
export default function CameraManager() {
  const tickListenerRef = useRef(null);
  const activeModeRef = useRef('free');
  const hudDataRef = useRef(null);
  const [hudData, setHudData] = useState(null);

  const cameraMode = useAppStore((s) => s.cameraMode);
  const hudVisible = useAppStore((s) => s.hudVisible);
  const detailSatelliteId = useSatelliteStore((s) => s.detailSatelliteId);

  useEffect(() => {
    const viewer = useAppStore.getState().viewerRef;
    if (!viewer || viewer.isDestroyed()) return;

    const targetMode = cameraMode;
    const prevMode = activeModeRef.current;

    // Guard: follow/pov require a selected satellite
    if ((targetMode === 'follow' || targetMode === 'pov') && detailSatelliteId == null) {
      return;
    }

    // No change
    if (targetMode === prevMode && targetMode === 'free') return;

    // Clean up previous mode
    cleanupMode(viewer, tickListenerRef);

    if (targetMode === 'free') {
      enterFreeMode(viewer);
      activeModeRef.current = 'free';
      return;
    }

    if (targetMode === 'follow') {
      enterFollowMode(viewer, detailSatelliteId, tickListenerRef, hudDataRef, setHudData);
      activeModeRef.current = 'follow';
      return;
    }

    if (targetMode === 'pov') {
      enterPovMode(viewer, detailSatelliteId, tickListenerRef, hudDataRef, setHudData);
      activeModeRef.current = 'pov';
      return;
    }

    // Unknown mode or skydome -- treat as free
    activeModeRef.current = targetMode;
  }, [cameraMode, detailSatelliteId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const viewer = useAppStore.getState().viewerRef;
      if (viewer && !viewer.isDestroyed()) {
        cleanupMode(viewer, tickListenerRef);
        enterFreeMode(viewer);
      }
    };
  }, []);

  // HUD overlay for POV mode
  const showHud = cameraMode === 'pov' && hudVisible && hudData;

  return showHud ? (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-30 glass px-4 py-2.5 pointer-events-none select-none"
      style={{ borderRadius: 8, minWidth: 280 }}
    >
      <div className="flex items-center gap-6 justify-center">
        <HudItem label="ALT" value={`${hudData.alt.toFixed(1)} km`} />
        <HudItem label="SPD" value={`${hudData.speed.toFixed(2)} km/s`} />
        <HudItem label="LAT" value={formatLatHud(hudData.lat)} />
        <HudItem label="LON" value={formatLonHud(hudData.lon)} />
      </div>
    </div>
  ) : null;
}

function HudItem({ label, value }) {
  return (
    <div className="text-center">
      <div
        className="text-[8px] tracking-[0.15em] uppercase"
        style={{ color: 'var(--accent)', fontWeight: 600 }}
      >
        {label}
      </div>
      <div
        className="text-[11px] tabular-nums font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </div>
    </div>
  );
}

function formatLatHud(deg) {
  return `${Math.abs(deg).toFixed(2)}\u00B0 ${deg >= 0 ? 'N' : 'S'}`;
}

function formatLonHud(deg) {
  return `${Math.abs(deg).toFixed(2)}\u00B0 ${deg >= 0 ? 'E' : 'W'}`;
}

/**
 * Remove any active tick listener.
 */
function cleanupMode(viewer, tickListenerRef) {
  if (tickListenerRef.current) {
    viewer.clock.onTick.removeEventListener(tickListenerRef.current);
    tickListenerRef.current = null;
  }
}

/**
 * Return to free camera mode.
 */
function enterFreeMode(viewer) {
  // Unlock camera from any transform
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  // Re-enable collision detection
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
  // Hide HUD
  useAppStore.getState().hudVisible && useAppStore.setState({ hudVisible: false });
}

/**
 * Get satrec for a satellite by NORAD ID.
 */
function getSatrec(noradId) {
  const sat = useSatelliteStore.getState().satellites.get(noradId);
  if (!sat || !sat.satrec) return null;
  return sat.satrec;
}

/**
 * Enter follow-cam mode: fly to satellite, then track with lookAtTransform.
 */
function enterFollowMode(viewer, noradId, tickListenerRef, hudDataRef, setHudData) {
  const satrec = getSatrec(noradId);
  if (!satrec) return;

  // Get current satellite position for fly-to target
  const jsDate = Cesium.JulianDate.toDate(viewer.clock.currentTime);
  const posVel = satellite.propagate(satrec, jsDate);
  if (!posVel.position) return;

  const gmst = satellite.gstime(jsDate);
  const geo = satellite.eciToGeodetic(posVel.position, gmst);
  const lon = satellite.degreesLong(geo.longitude);
  const lat = satellite.degreesLat(geo.latitude);
  const altM = geo.height * 1000;

  // Fly to above the satellite
  const destination = Cesium.Cartesian3.fromDegrees(lon, lat, altM + 500000);

  viewer.camera.flyTo({
    destination,
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-90),
      roll: 0,
    },
    duration: 1.5,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    complete: () => {
      // After fly-to, engage per-tick tracking
      const hpr = new Cesium.HeadingPitchRange(
        0,
        Cesium.Math.toRadians(-90),
        500000
      );

      const listener = (clock) => {
        const date = Cesium.JulianDate.toDate(clock.currentTime);
        const pv = satellite.propagate(satrec, date);
        if (!pv.position) return;

        const g = satellite.gstime(date);
        const gd = satellite.eciToGeodetic(pv.position, g);
        const cartesian = Cesium.Cartesian3.fromDegrees(
          satellite.degreesLong(gd.longitude),
          satellite.degreesLat(gd.latitude),
          gd.height * 1000
        );

        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(cartesian);
        viewer.camera.lookAtTransform(transform, hpr);
      };

      tickListenerRef.current = listener;
      viewer.clock.onTick.addEventListener(listener);
    },
  });
}

/**
 * Enter POV mode: fly to satellite, then track with setView along velocity.
 */
function enterPovMode(viewer, noradId, tickListenerRef, hudDataRef, setHudData) {
  const satrec = getSatrec(noradId);
  if (!satrec) return;

  // Disable collision detection for space camera
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;

  // Get current satellite position for fly-to
  const jsDate = Cesium.JulianDate.toDate(viewer.clock.currentTime);
  const posVel = satellite.propagate(satrec, jsDate);
  if (!posVel.position || !posVel.velocity) return;

  const gmst = satellite.gstime(jsDate);
  const ecfPos = satellite.eciToEcf(posVel.position, gmst);
  const destination = new Cesium.Cartesian3(
    ecfPos.x * 1000,
    ecfPos.y * 1000,
    ecfPos.z * 1000
  );

  viewer.camera.flyTo({
    destination,
    duration: 1.5,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    complete: () => {
      // After fly-to, engage per-tick POV tracking
      const listener = (clock) => {
        const date = Cesium.JulianDate.toDate(clock.currentTime);
        const pv = satellite.propagate(satrec, date);
        if (!pv.position || !pv.velocity) return;

        const g = satellite.gstime(date);
        const ePos = satellite.eciToEcf(pv.position, g);
        const eVel = satellite.eciToEcf(pv.velocity, g);

        const dest = new Cesium.Cartesian3(
          ePos.x * 1000,
          ePos.y * 1000,
          ePos.z * 1000
        );
        const dir = Cesium.Cartesian3.normalize(
          new Cesium.Cartesian3(eVel.x * 1000, eVel.y * 1000, eVel.z * 1000),
          new Cesium.Cartesian3()
        );
        const up = Cesium.Cartesian3.normalize(
          new Cesium.Cartesian3(dest.x, dest.y, dest.z),
          new Cesium.Cartesian3()
        );

        viewer.camera.setView({
          destination: dest,
          orientation: { direction: dir, up },
        });

        // Update HUD data
        const gd = satellite.eciToGeodetic(pv.position, g);
        const velMag = Math.sqrt(
          pv.velocity.x ** 2 + pv.velocity.y ** 2 + pv.velocity.z ** 2
        );
        const newHudData = {
          alt: gd.height,
          speed: velMag,
          lat: satellite.degreesLat(gd.latitude),
          lon: satellite.degreesLong(gd.longitude),
        };
        hudDataRef.current = newHudData;
        setHudData(newHudData);
      };

      tickListenerRef.current = listener;
      viewer.clock.onTick.addEventListener(listener);
    },
  });
}
