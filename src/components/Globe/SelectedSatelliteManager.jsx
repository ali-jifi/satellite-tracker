import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import * as satellite from 'satellite.js';
import useAppStore from '../../stores/appStore';
import useSatelliteStore from '../../stores/satelliteStore';
import { getColorForSatellite } from '../../utils/colorModes';

const ORBIT_POINTS = 360;
const ORBIT_REFRESH_MS = 60_000;
const GROUND_TRACK_POINTS_PER_HALF = 180;
const EARTH_RADIUS_M = 6_371_000;

// promotes selected sats to CesiumJS entities (pulsing point, label, orbit, ground tracks, footprint)
export default function SelectedSatelliteManager() {
  const entitiesRef = useRef(new Map()); // noradId -> entity IDs map
  const orbitIntervalRef = useRef(null);
  const unsubRef = useRef(null);
  const unsubLabelsRef = useRef(null);
  const unsubVisibilityRef = useRef(null);

  useEffect(() => {
    const viewer = useAppStore.getState().viewerRef;
    if (!viewer || viewer.isDestroyed()) return;

    let prevSelectedIds = new Set(useSatelliteStore.getState().selectedIds);

    // sync entities with selected IDs
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

      for (const id of removed) {
        removeEntity(viewer, id, entitiesRef.current);
      }
      for (const id of added) {
        addEntity(viewer, id, entitiesRef.current);
      }
    }

    // init sync
    syncSelection(useSatelliteStore.getState().selectedIds);

    // sub to selection changes
    unsubRef.current = useSatelliteStore.subscribe((state) => {
      if (state.selectedIds !== prevSelectedIds) {
        syncSelection(state.selectedIds);
      }
    });

    // label visibility reactivity
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

    // visibility toggle reactivity for ground tracks, orbit lines, footprints
    let prevGroundTracksVisible = useAppStore.getState().groundTracksVisible;
    let prevOrbitLinesVisible = useAppStore.getState().orbitLinesVisible;
    let prevFootprintsVisible = useAppStore.getState().footprintsVisible;

    unsubVisibilityRef.current = useAppStore.subscribe((state) => {
      if (state.groundTracksVisible !== prevGroundTracksVisible) {
        prevGroundTracksVisible = state.groundTracksVisible;
        for (const entry of entitiesRef.current.values()) {
          for (const gtId of entry.groundTrackIds) {
            const e = viewer.entities.getById(gtId);
            if (e) e.show = state.groundTracksVisible;
          }
        }
      }

      if (state.orbitLinesVisible !== prevOrbitLinesVisible) {
        prevOrbitLinesVisible = state.orbitLinesVisible;
        for (const entry of entitiesRef.current.values()) {
          const e = viewer.entities.getById(entry.orbitEntityId);
          if (e) e.show = state.orbitLinesVisible;
        }
      }

      if (state.footprintsVisible !== prevFootprintsVisible) {
        prevFootprintsVisible = state.footprintsVisible;
        for (const entry of entitiesRef.current.values()) {
          const e = viewer.entities.getById(entry.footprintEntityId);
          if (e) e.show = state.footprintsVisible;
        }
      }
    });

    // periodic orbit + ground track recomputation
    orbitIntervalRef.current = setInterval(() => {
      for (const id of entitiesRef.current.keys()) {
        updateOrbitLine(viewer, id);
        updateGroundTracks(viewer, id, entitiesRef.current);
      }
    }, ORBIT_REFRESH_MS);

    return () => {
      if (unsubRef.current) unsubRef.current();
      if (unsubLabelsRef.current) unsubLabelsRef.current();
      if (unsubVisibilityRef.current) unsubVisibilityRef.current();
      if (orbitIntervalRef.current) clearInterval(orbitIntervalRef.current);

      for (const id of entitiesRef.current.keys()) {
        removeEntity(viewer, id, entitiesRef.current);
      }
    };
  }, []);

  return null;
}

// get current sim time in ms
function getSimTimeMs() {
  const viewer = useAppStore.getState().viewerRef;
  return viewer
    ? Cesium.JulianDate.toDate(viewer.clock.currentTime).getTime()
    : Date.now();
}

// add entity for selected sat (pulsing point + label + orbit + ground tracks + footprint)
function addEntity(viewer, noradId, entityMap) {
  if (viewer.isDestroyed()) return;
  if (entityMap.has(noradId)) return;

  const sat = useSatelliteStore.getState().satellites.get(noradId);
  if (!sat) return;

  const colorMode = useSatelliteStore.getState().colorMode;
  const satColor = getColorForSatellite(sat, colorMode);
  const labelsVisible = useAppStore.getState().labelsVisible;
  const groundTracksVisible = useAppStore.getState().groundTracksVisible;
  const orbitLinesVisible = useAppStore.getState().orbitLinesVisible;
  const footprintsVisible = useAppStore.getState().footprintsVisible;

  const pointEntityId = `sat-point-${noradId}`;
  const orbitEntityId = `sat-orbit-${noradId}`;
  const footprintEntityId = `footprint-${noradId}`;

  // pulsing point w/ label - pos read from positionBuffer via CallbackProperty
  const positionCallback = new Cesium.CallbackProperty(() => {
    const { positionBuffer, positionCount } = useSatelliteStore.getState();
    if (!positionBuffer) return Cesium.Cartesian3.ZERO;

    const stride = 5;
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

  // pulsing pixel size (6-12) via CallbackProperty
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

  // orbit polyline
  const orbitPositions = computeOrbitPositions(sat);
  if (orbitPositions.length > 0) {
    viewer.entities.add({
      id: orbitEntityId,
      show: orbitLinesVisible,
      polyline: {
        positions: orbitPositions,
        width: 1.5,
        material: satColor.withAlpha(0.7),
      },
    });
  }

  // ground tracks
  const groundTrackIds = createGroundTrackEntities(viewer, noradId, sat, satColor, groundTracksVisible);

  // footprint
  const footprintPositionCallback = new Cesium.CallbackProperty(() => {
    const { positionBuffer, positionCount } = useSatelliteStore.getState();
    if (!positionBuffer) return Cesium.Cartesian3.ZERO;

    const stride = 5;
    for (let i = 0; i < positionCount; i++) {
      const offset = i * stride;
      if (positionBuffer[offset] === noradId) {
        return Cesium.Cartesian3.fromDegrees(
          positionBuffer[offset + 2],
          positionBuffer[offset + 1],
          0 // clamped to surface
        );
      }
    }
    return Cesium.Cartesian3.ZERO;
  }, false);

  const footprintRadiusCallback = new Cesium.CallbackProperty(() => {
    const { positionBuffer, positionCount } = useSatelliteStore.getState();
    if (!positionBuffer) return 0;

    const stride = 5;
    for (let i = 0; i < positionCount; i++) {
      const offset = i * stride;
      if (positionBuffer[offset] === noradId) {
        const altKm = positionBuffer[offset + 3];
        const h = altKm * 1000; // m
        if (h <= 0) return 0;
        const ratio = EARTH_RADIUS_M / (EARTH_RADIUS_M + h);
        return EARTH_RADIUS_M * Math.acos(ratio < 1 ? ratio : 1);
      }
    }
    return 0;
  }, false);

  viewer.entities.add({
    id: footprintEntityId,
    show: footprintsVisible,
    position: footprintPositionCallback,
    ellipse: {
      semiMinorAxis: footprintRadiusCallback,
      semiMajorAxis: footprintRadiusCallback,
      material: Cesium.Color.fromCssColorString('#38f3bf').withAlpha(0.08),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString('#38f3bf').withAlpha(0.3),
      outlineWidth: 1,
      height: 0,
      classificationType: Cesium.ClassificationType.BOTH,
    },
  });

  entityMap.set(noradId, { pointEntityId, orbitEntityId, footprintEntityId, groundTrackIds });
}

// create ground track polyline entities for past/future segments, returns entity IDs
function createGroundTrackEntities(viewer, noradId, sat, satColor, visible) {
  const { pastSegments, futureSegments } = computeGroundTrack(sat);
  const ids = [];

  for (let i = 0; i < pastSegments.length; i++) {
    const seg = pastSegments[i];
    if (seg.length < 2) continue;
    const id = `ground-track-past-${noradId}-${i}`;
    viewer.entities.add({
      id,
      show: visible,
      polyline: {
        positions: seg.map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat)),
        clampToGround: true,
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: satColor.withAlpha(0.4),
          dashLength: 8.0,
          dashPattern: 255,
        }),
      },
    });
    ids.push(id);
  }

  for (let i = 0; i < futureSegments.length; i++) {
    const seg = futureSegments[i];
    if (seg.length < 2) continue;
    const id = `ground-track-future-${noradId}-${i}`;
    viewer.entities.add({
      id,
      show: visible,
      polyline: {
        positions: seg.map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat)),
        clampToGround: true,
        width: 2,
        material: satColor.withAlpha(0.8),
      },
    });
    ids.push(id);
  }

  return ids;
}

// remove entity for a deselected sat
function removeEntity(viewer, noradId, entityMap) {
  if (viewer.isDestroyed()) return;

  const entry = entityMap.get(noradId);
  if (!entry) return;

  const pointEntity = viewer.entities.getById(entry.pointEntityId);
  if (pointEntity) viewer.entities.remove(pointEntity);

  const orbitEntity = viewer.entities.getById(entry.orbitEntityId);
  if (orbitEntity) viewer.entities.remove(orbitEntity);

  const footprintEntity = viewer.entities.getById(entry.footprintEntityId);
  if (footprintEntity) viewer.entities.remove(footprintEntity);

  for (const gtId of entry.groundTrackIds) {
    const e = viewer.entities.getById(gtId);
    if (e) viewer.entities.remove(e);
  }

  entityMap.delete(noradId);
}

// recompute orbit polyline positions for a sat
function updateOrbitLine(viewer, noradId) {
  if (viewer.isDestroyed()) return;

  const sat = useSatelliteStore.getState().satellites.get(noradId);
  if (!sat) return;

  const orbitEntityId = `sat-orbit-${noradId}`;
  const orbitEntity = viewer.entities.getById(orbitEntityId);
  if (!orbitEntity || !orbitEntity.polyline) return;

  const orbitPositions = computeOrbitPositions(sat);
  if (orbitPositions.length > 0) {
    orbitEntity.polyline.positions = orbitPositions;
  }
}

// recompute ground track entities for a sat (remove old, create new)
function updateGroundTracks(viewer, noradId, entityMap) {
  if (viewer.isDestroyed()) return;

  const entry = entityMap.get(noradId);
  if (!entry) return;

  // remove old ground track entities
  for (const gtId of entry.groundTrackIds) {
    const e = viewer.entities.getById(gtId);
    if (e) viewer.entities.remove(e);
  }

  const sat = useSatelliteStore.getState().satellites.get(noradId);
  if (!sat) return;

  const colorMode = useSatelliteStore.getState().colorMode;
  const satColor = getColorForSatellite(sat, colorMode);
  const groundTracksVisible = useAppStore.getState().groundTracksVisible;

  entry.groundTrackIds = createGroundTrackEntities(viewer, noradId, sat, satColor, groundTracksVisible);
}

// compute ~360 positions for one full orbit, uses sim time from CesiumJS clock
function computeOrbitPositions(sat) {
  if (!sat.tle1 || !sat.tle2) return [];

  try {
    const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
    const periodMinutes = sat.period || 90;
    const periodMs = periodMinutes * 60 * 1000;
    const now = getSimTimeMs();
    const positions = [];

    for (let i = 0; i <= ORBIT_POINTS; i++) {
      const t = new Date(now + (i / ORBIT_POINTS) * periodMs);
      const gmst = satellite.gstime(t);
      const posVel = satellite.propagate(satrec, t);

      if (!posVel.position || typeof posVel.position !== 'object') continue;

      const geo = satellite.eciToGeodetic(posVel.position, gmst);
      const lat = satellite.degreesLat(geo.latitude);
      const lon = satellite.degreesLong(geo.longitude);
      const alt = geo.height * 1000;

      positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, alt));
    }

    return positions;
  } catch {
    return [];
  }
}

// compute ground track segments with antimeridian splitting
function computeGroundTrack(sat) {
  const pastSegments = [];
  const futureSegments = [];

  if (!sat.tle1 || !sat.tle2) return { pastSegments, futureSegments };

  try {
    const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
    const periodMinutes = sat.period || 90;
    const halfPeriodMs = (periodMinutes * 60 * 1000) / 2;
    const now = getSimTimeMs();

    // past: from -halfPeriod to now
    const pastPoints = propagateTrack(satrec, now - halfPeriodMs, now, GROUND_TRACK_POINTS_PER_HALF);
    splitAtAntimeridian(pastPoints, pastSegments);

    // future: from now to +halfPeriod
    const futurePoints = propagateTrack(satrec, now, now + halfPeriodMs, GROUND_TRACK_POINTS_PER_HALF);
    splitAtAntimeridian(futurePoints, futureSegments);
  } catch {
    // propagation failed
  }

  return { pastSegments, futureSegments };
}

// propagate sat from startMs to endMs, returns [{lat, lon}]
function propagateTrack(satrec, startMs, endMs, numPoints) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = new Date(startMs + (i / numPoints) * (endMs - startMs));
    const gmst = satellite.gstime(t);
    const posVel = satellite.propagate(satrec, t);

    if (!posVel.position || typeof posVel.position !== 'object') continue;

    const geo = satellite.eciToGeodetic(posVel.position, gmst);
    points.push({
      lat: satellite.degreesLat(geo.latitude),
      lon: satellite.degreesLong(geo.longitude),
    });
  }
  return points;
}

// split track into segments at antimeridian crossings (lon diff > 180)
function splitAtAntimeridian(points, segments) {
  if (points.length === 0) return;

  let current = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const lonDiff = Math.abs(points[i].lon - points[i - 1].lon);
    if (lonDiff > 180) {
      // antimeridian crossing - push current seg, start new one
      if (current.length >= 2) {
        segments.push(current);
      }
      current = [points[i]];
    } else {
      current.push(points[i]);
    }
  }

  if (current.length >= 2) {
    segments.push(current);
  }
}
