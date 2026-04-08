import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import * as satellite from 'satellite.js';
import useAppStore from '../../stores/appStore';
import useSatelliteStore from '../../stores/satelliteStore';
import { getColorForSatellite } from '../../utils/colorModes';

const ORBIT_POINTS = 360;
const ORBIT_REFRESH_MS = 60_000;

/**
 * SelectedSatelliteManager — promotes selected satellites to CesiumJS Entities
 * with pulsing point, name label, and full orbit polyline.
 *
 * All Cesium objects managed via refs. Component renders null.
 */
export default function SelectedSatelliteManager() {
  const entitiesRef = useRef(new Map()); // noradId -> { point, orbit, label } entity ids
  const orbitIntervalRef = useRef(null);
  const unsubRef = useRef(null);
  const unsubLabelsRef = useRef(null);

  useEffect(() => {
    const viewer = useAppStore.getState().viewerRef;
    if (!viewer || viewer.isDestroyed()) return;

    let prevSelectedIds = new Set(useSatelliteStore.getState().selectedIds);

    // Sync entities with selected IDs
    function syncSelection(selectedIds) {
      const added = [];
      const removed = [];

      for (const id of selectedIds) {
        if (!prevSelectedIds.has(id)) added.push(id);
      }
      for (const id of prevSelectedIds) {
        if (!selectedIds.has(id)) removed.push(id);
      }

      prevSelectedIds = new Set(selectedIds);

      // Remove deselected
      for (const id of removed) {
        removeEntity(viewer, id, entitiesRef.current);
      }

      // Add newly selected
      for (const id of added) {
        addEntity(viewer, id, entitiesRef.current);
      }
    }

    // Initial sync
    syncSelection(useSatelliteStore.getState().selectedIds);

    // Subscribe to selection changes
    unsubRef.current = useSatelliteStore.subscribe((state) => {
      if (state.selectedIds !== prevSelectedIds) {
        syncSelection(state.selectedIds);
      }
    });

    // Label visibility reactivity
    let prevLabelsVisible = useAppStore.getState().labelsVisible;
    unsubLabelsRef.current = useAppStore.subscribe((state) => {
      if (state.labelsVisible === prevLabelsVisible) return;
      prevLabelsVisible = state.labelsVisible;

      for (const entry of entitiesRef.current.values()) {
        const entity = viewer.entities.getById(entry.pointEntityId);
        if (entity && entity.label) {
          entity.label.show = state.labelsVisible;
        }
      }
    });

    // Periodic orbit recomputation
    orbitIntervalRef.current = setInterval(() => {
      for (const id of entitiesRef.current.keys()) {
        updateOrbitLine(viewer, id);
      }
    }, ORBIT_REFRESH_MS);

    return () => {
      if (unsubRef.current) unsubRef.current();
      if (unsubLabelsRef.current) unsubLabelsRef.current();
      if (orbitIntervalRef.current) clearInterval(orbitIntervalRef.current);

      // Remove all entities
      for (const id of entitiesRef.current.keys()) {
        removeEntity(viewer, id, entitiesRef.current);
      }
    };
  }, []);

  return null;
}

/**
 * Add Entity for a selected satellite (pulsing point + label + orbit line).
 */
function addEntity(viewer, noradId, entityMap) {
  if (viewer.isDestroyed()) return;
  if (entityMap.has(noradId)) return;

  const sat = useSatelliteStore.getState().satellites.get(noradId);
  if (!sat) return;

  const colorMode = useSatelliteStore.getState().colorMode;
  const satColor = getColorForSatellite(sat, colorMode);
  const labelsVisible = useAppStore.getState().labelsVisible;

  const pointEntityId = `sat-point-${noradId}`;
  const orbitEntityId = `sat-orbit-${noradId}`;

  // Pulsing point with label — position read from positionBuffer via CallbackProperty
  const positionCallback = new Cesium.CallbackProperty(() => {
    const { positionBuffer, positionCount } = useSatelliteStore.getState();
    if (!positionBuffer) return Cesium.Cartesian3.ZERO;

    const stride = 4;
    for (let i = 0; i < positionCount; i++) {
      const offset = i * stride;
      if (positionBuffer[offset] === noradId) {
        return Cesium.Cartesian3.fromDegrees(
          positionBuffer[offset + 2], // lon
          positionBuffer[offset + 1], // lat
          positionBuffer[offset + 3] * 1000 // alt km -> m
        );
      }
    }
    return Cesium.Cartesian3.ZERO;
  }, false);

  // Pulsing pixel size (6-12) via CallbackProperty
  const pixelSizeCallback = new Cesium.CallbackProperty(() => {
    return Math.sin(Date.now() * 0.005) * 3 + 9;
  }, false);

  viewer.entities.add({
    id: pointEntityId,
    position: positionCallback,
    point: {
      pixelSize: pixelSizeCallback,
      color: satColor,
      outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
      outlineWidth: 1,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      show: labelsVisible,
      text: sat.name || `NORAD ${noradId}`,
      font: '12px JetBrains Mono',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -18),
      showBackground: true,
      backgroundColor: new Cesium.Color(0, 0, 0, 0.6),
      backgroundPadding: new Cesium.Cartesian2(6, 4),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  // Orbit polyline
  const orbitPositions = computeOrbitPositions(sat);
  if (orbitPositions.length > 0) {
    viewer.entities.add({
      id: orbitEntityId,
      polyline: {
        positions: orbitPositions,
        width: 1.5,
        material: satColor.withAlpha(0.7),
      },
    });
  }

  entityMap.set(noradId, { pointEntityId, orbitEntityId });
}

/**
 * Remove Entity for a deselected satellite.
 */
function removeEntity(viewer, noradId, entityMap) {
  if (viewer.isDestroyed()) return;

  const entry = entityMap.get(noradId);
  if (!entry) return;

  const pointEntity = viewer.entities.getById(entry.pointEntityId);
  if (pointEntity) viewer.entities.remove(pointEntity);

  const orbitEntity = viewer.entities.getById(entry.orbitEntityId);
  if (orbitEntity) viewer.entities.remove(orbitEntity);

  entityMap.delete(noradId);
}

/**
 * Recompute orbit polyline positions for a satellite.
 */
function updateOrbitLine(viewer, noradId) {
  if (viewer.isDestroyed()) return;

  const sat = useSatelliteStore.getState().satellites.get(noradId);
  if (!sat) return;

  const entityMap = null; // we update in place
  const orbitEntityId = `sat-orbit-${noradId}`;
  const orbitEntity = viewer.entities.getById(orbitEntityId);
  if (!orbitEntity || !orbitEntity.polyline) return;

  const orbitPositions = computeOrbitPositions(sat);
  if (orbitPositions.length > 0) {
    orbitEntity.polyline.positions = orbitPositions;
  }
}

/**
 * Compute ~360 positions for one full orbit of a satellite.
 * Uses the satellite's period to determine time span.
 */
function computeOrbitPositions(sat) {
  if (!sat.tle1 || !sat.tle2) return [];

  try {
    const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
    const periodMinutes = sat.period || 90; // default to ~90 min if unknown
    const periodMs = periodMinutes * 60 * 1000;
    const now = Date.now();
    const positions = [];

    for (let i = 0; i <= ORBIT_POINTS; i++) {
      const t = new Date(now + (i / ORBIT_POINTS) * periodMs);
      const gmst = satellite.gstime(t);
      const posVel = satellite.propagate(satrec, t);

      if (!posVel.position || typeof posVel.position !== 'object') continue;

      const geo = satellite.eciToGeodetic(posVel.position, gmst);
      const lat = satellite.degreesLat(geo.latitude);
      const lon = satellite.degreesLong(geo.longitude);
      const alt = geo.height * 1000; // km -> m

      positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, alt));
    }

    return positions;
  } catch {
    return [];
  }
}
