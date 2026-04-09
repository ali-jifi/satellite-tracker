import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import * as satellite from 'satellite.js';
import useAppStore from '../../stores/appStore';
import useAnalysisStore from '../../stores/analysisStore';
import useSatelliteStore from '../../stores/satelliteStore';

/**
 * AnalysisVisualizationManager — render-null imperative component.
 * Subscribes to analysisStore to highlight constellation satellites on the globe
 * by recoloring PointPrimitives in the existing PointPrimitiveCollection.
 */
export default function AnalysisVisualizationManager() {
  const initializedRef = useRef(false);
  const originalColorsRef = useRef(new Map()); // noradId -> Cesium.Color
  const currentConstellationRef = useRef(null);
  const closeApproachEntitiesRef = useRef([]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const HIGHLIGHT_COLOR = Cesium.Color.CYAN;

    function getPointCollection() {
      const viewer = useAppStore.getState().viewerRef;
      if (!viewer || viewer.isDestroyed()) return null;

      // Find the PointPrimitiveCollection in the scene primitives
      const primitives = viewer.scene.primitives;
      for (let i = 0; i < primitives.length; i++) {
        const p = primitives.get(i);
        if (p instanceof Cesium.PointPrimitiveCollection) {
          return p;
        }
      }
      return null;
    }

    function getPointMap(collection) {
      // Build a map of noradId -> point primitive
      const map = new Map();
      for (let i = 0; i < collection.length; i++) {
        const point = collection.get(i);
        if (point && point.id != null) {
          map.set(point.id, point);
        }
      }
      return map;
    }

    function clearHighlight() {
      const collection = getPointCollection();
      if (!collection) return;

      for (const [id, origColor] of originalColorsRef.current) {
        // Find the point by iterating (we cached the color by id)
        for (let i = 0; i < collection.length; i++) {
          const point = collection.get(i);
          if (point && point.id === id) {
            point.color = origColor;
            break;
          }
        }
      }
      originalColorsRef.current.clear();
      currentConstellationRef.current = null;
    }

    function applyHighlight(constellationName, constellationData) {
      const collection = getPointCollection();
      if (!collection || !constellationData) return;

      // Find the constellation in the data
      const constellation = constellationData.find((c) => c.name === constellationName);
      if (!constellation) return;

      // Build a set of satellite IDs in this constellation
      const satIds = new Set(constellation.satellites.map((s) => s.id));

      // Iterate all points and highlight matching ones
      for (let i = 0; i < collection.length; i++) {
        const point = collection.get(i);
        if (!point || point.id == null) continue;

        if (satIds.has(point.id)) {
          // Store original color before changing
          if (!originalColorsRef.current.has(point.id)) {
            originalColorsRef.current.set(point.id, point.color.clone());
          }
          point.color = HIGHLIGHT_COLOR;
          point.pixelSize = 3.5;
        }
      }

      currentConstellationRef.current = constellationName;
    }

    // Subscribe to highlighted constellation changes
    const unsub = useAnalysisStore.subscribe(
      (state) => ({
        highlighted: state.highlightedConstellation,
        data: state.constellationData,
      }),
      (curr, prev) => {
        if (curr.highlighted === prev.highlighted) return;

        // Clear previous highlighting
        clearHighlight();

        // Apply new highlighting if a constellation is selected
        if (curr.highlighted && curr.data) {
          applyHighlight(curr.highlighted, curr.data);
        }
      },
      { equalityFn: (a, b) => a.highlighted === b.highlighted }
    );

    // --- Close approach visualization ---

    function clearCloseApproachViz() {
      const viewer = useAppStore.getState().viewerRef;
      if (!viewer || viewer.isDestroyed()) return;
      for (const entity of closeApproachEntitiesRef.current) {
        viewer.entities.remove(entity);
      }
      closeApproachEntitiesRef.current = [];
    }

    function computeOrbitPositions(sat, date, steps = 120) {
      if (!sat || !sat.tle1 || !sat.tle2) return [];
      let satrec;
      try {
        satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
      } catch {
        return [];
      }

      // One full orbit period (minutes from satrec)
      const periodMin = (2 * Math.PI) / satrec.no; // no is in rad/min
      const periodMs = periodMin * 60000;
      const stepMs = periodMs / steps;
      const positions = [];
      const startMs = date.getTime() - periodMs / 2;

      for (let i = 0; i <= steps; i++) {
        const t = new Date(startMs + i * stepMs);
        try {
          const posVel = satellite.propagate(satrec, t);
          if (posVel.position && typeof posVel.position === 'object') {
            const gmst = satellite.gstime(t);
            const geo = satellite.eciToGeodetic(posVel.position, gmst);
            positions.push(
              Cesium.Cartesian3.fromDegrees(
                satellite.degreesLong(geo.longitude),
                satellite.degreesLat(geo.latitude),
                geo.height * 1000 // km to meters
              )
            );
          }
        } catch {
          // skip
        }
      }
      return positions;
    }

    function applyCloseApproachViz(vizData) {
      const viewer = useAppStore.getState().viewerRef;
      if (!viewer || viewer.isDestroyed() || !vizData) return;

      clearCloseApproachViz();

      const { referenceSatId, approachSatId, approachTime, refPositionEci, candPositionEci } = vizData;

      // Convert ECI positions to Cartographic for the approach point marker
      const approachDate = new Date(approachTime);
      const gmst = satellite.gstime(approachDate);

      // Use the midpoint between the two satellites as the approach marker
      if (refPositionEci && candPositionEci) {
        const midEci = {
          x: (refPositionEci.x + candPositionEci.x) / 2,
          y: (refPositionEci.y + candPositionEci.y) / 2,
          z: (refPositionEci.z + candPositionEci.z) / 2,
        };
        const geo = satellite.eciToGeodetic(midEci, gmst);
        const lon = satellite.degreesLong(geo.longitude);
        const lat = satellite.degreesLat(geo.latitude);
        const alt = geo.height * 1000; // km to m

        // Approach point marker
        const marker = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
          point: {
            pixelSize: 12,
            color: Cesium.Color.fromCssColorString('#ff4444'),
            outlineColor: Cesium.Color.fromCssColorString('#ff8800'),
            outlineWidth: 2,
          },
          label: {
            text: `CA: ${vizData.distanceKm.toFixed(1)} km`,
            font: '11px JetBrains Mono',
            fillColor: Cesium.Color.fromCssColorString('#ff8800'),
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 1,
            outlineColor: Cesium.Color.BLACK,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -16),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        closeApproachEntitiesRef.current.push(marker);
      }

      // Draw orbit lines for both satellites
      const sats = useSatelliteStore.getState().satellites;
      const refSat = sats.get(referenceSatId);
      const appSat = sats.get(approachSatId);

      if (refSat) {
        const refPositions = computeOrbitPositions(refSat, approachDate);
        if (refPositions.length > 1) {
          const refOrbit = viewer.entities.add({
            polyline: {
              positions: refPositions,
              width: 1.5,
              material: new Cesium.ColorMaterialProperty(
                Cesium.Color.fromCssColorString('rgba(0, 200, 255, 0.6)')
              ),
            },
          });
          closeApproachEntitiesRef.current.push(refOrbit);
        }
      }

      if (appSat) {
        const appPositions = computeOrbitPositions(appSat, approachDate);
        if (appPositions.length > 1) {
          const appOrbit = viewer.entities.add({
            polyline: {
              positions: appPositions,
              width: 1.5,
              material: new Cesium.ColorMaterialProperty(
                Cesium.Color.fromCssColorString('rgba(255, 100, 50, 0.6)')
              ),
            },
          });
          closeApproachEntitiesRef.current.push(appOrbit);
        }
      }
    }

    // Subscribe to close approach visualization changes
    const unsubCA = useAnalysisStore.subscribe(
      (state) => state.closeApproachVisualization,
      (curr, prev) => {
        if (curr === prev) return;
        if (curr) {
          applyCloseApproachViz(curr);
        } else {
          clearCloseApproachViz();
        }
      }
    );

    return () => {
      unsub();
      unsubCA();
      clearHighlight();
      clearCloseApproachViz();
      initializedRef.current = false;
    };
  }, []);

  return null;
}
