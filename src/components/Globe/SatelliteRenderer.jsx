import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import useAppStore from '../../stores/appStore';
import useSatelliteStore from '../../stores/satelliteStore';
import { getColorForSatelliteRaw, isDebris } from '../../utils/colorModes';

/**
 * SatelliteRenderer — renders 30k+ satellites as PointPrimitives.
 *
 * All position updates are imperative (refs + requestAnimationFrame).
 * Component renders null. No React state for positions.
 */
export default function SatelliteRenderer() {
  const collectionRef = useRef(null);
  const pointIndexMapRef = useRef(new Map()); // noradId -> point index
  const pointArrayRef = useRef([]);           // flat array of point primitives
  const satLookupRef = useRef(new Map());     // noradId -> satellite object (for recoloring)
  const handlerRef = useRef(null);
  const rafIdRef = useRef(null);
  const lastBufferRef = useRef(null);
  const unsubFilterRef = useRef(null);
  const unsubColorRef = useRef(null);
  const unsubCatalogRef = useRef(null);
  const unsubDebrisRef = useRef(null);

  useEffect(() => {
    const viewer = useAppStore.getState().viewerRef;
    if (!viewer || viewer.isDestroyed()) return;

    // Create PointPrimitiveCollection
    const collection = new Cesium.PointPrimitiveCollection();
    viewer.scene.primitives.add(collection);
    collectionRef.current = collection;

    // Track whether we've built points yet
    let pointsBuilt = false;

    function buildPoints() {
      if (pointsBuilt) return;
      const { satelliteArray, colorMode } = useSatelliteStore.getState();
      if (satelliteArray.length === 0) return;

      pointsBuilt = true;
      const indexMap = new Map();
      const pointArr = [];
      const satLookup = new Map();

      for (let i = 0; i < satelliteArray.length; i++) {
        const sat = satelliteArray[i];
        const rawColor = getColorForSatelliteRaw(sat, colorMode);

        const point = collection.add({
          position: Cesium.Cartesian3.ZERO,
          pixelSize: 2.0,
          color: new Cesium.Color(rawColor.red, rawColor.green, rawColor.blue, 1.0),
          show: false, // hidden until first position update
          id: sat.id,
        });

        indexMap.set(sat.id, i);
        pointArr.push(point);
        satLookup.set(sat.id, sat);
      }

      pointIndexMapRef.current = indexMap;
      pointArrayRef.current = pointArr;
      satLookupRef.current = satLookup;
    }

    // Try building immediately if catalog already loaded
    if (useSatelliteStore.getState().catalogLoaded) {
      buildPoints();
    }

    // Subscribe to catalogLoaded changes
    let prevCatalogLoaded = useSatelliteStore.getState().catalogLoaded;
    unsubCatalogRef.current = useSatelliteStore.subscribe((state) => {
      if (state.catalogLoaded && !prevCatalogLoaded) {
        prevCatalogLoaded = state.catalogLoaded;
        buildPoints();
      }
    });

    // Position update loop via requestAnimationFrame
    const scratchCartesian = new Cesium.Cartesian3();

    function updatePositions() {
      rafIdRef.current = requestAnimationFrame(updatePositions);

      const { positionBuffer, positionCount } = useSatelliteStore.getState();
      if (!positionBuffer || positionBuffer === lastBufferRef.current) return;
      lastBufferRef.current = positionBuffer;

      const indexMap = pointIndexMapRef.current;
      const pointArr = pointArrayRef.current;
      if (pointArr.length === 0) return;

      const selectedIds = useSatelliteStore.getState().selectedIds;
      const debrisHidden = !useAppStore.getState().debrisVisible;
      const satLookup = satLookupRef.current;
      const stride = 5;

      for (let i = 0; i < positionCount; i++) {
        const offset = i * stride;
        const id = positionBuffer[offset];
        const lat = positionBuffer[offset + 1];
        const lon = positionBuffer[offset + 2];
        const alt = positionBuffer[offset + 3]; // km

        const idx = indexMap.get(id);
        if (idx === undefined) continue;

        const point = pointArr[idx];
        if (!point) continue;

        // Hide if selected (SelectedSatelliteManager handles rendering)
        if (selectedIds.has(id)) {
          point.show = false;
          continue;
        }

        // Hide debris when debrisVisible is off
        if (debrisHidden) {
          const sat = satLookup.get(id);
          if (sat && isDebris(sat)) {
            point.show = false;
            continue;
          }
        }

        Cesium.Cartesian3.fromDegrees(lon, lat, alt * 1000, Cesium.Ellipsoid.WGS84, scratchCartesian);
        point.position = scratchCartesian;
        point.show = true;
      }
    }

    rafIdRef.current = requestAnimationFrame(updatePositions);

    // Click-to-select via ScreenSpaceEventHandler
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    handler.setInputAction((event) => {
      const picked = viewer.scene.pick(event.position);
      if (!picked || !picked.primitive) return;

      // Check if the picked primitive belongs to our collection
      if (picked.collection === collection && picked.primitive.id !== undefined) {
        useSatelliteStore.getState().toggleSatellite(picked.primitive.id);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Filter reactivity — show/hide points based on activeFilter
    let prevFilter = useSatelliteStore.getState().activeFilter;
    unsubFilterRef.current = useSatelliteStore.subscribe((state) => {
      if (state.activeFilter === prevFilter) return;
      prevFilter = state.activeFilter;

      const pointArr = pointArrayRef.current;
      const satLookup = satLookupRef.current;
      if (pointArr.length === 0) return;

      const filter = state.activeFilter;
      const indexMap = pointIndexMapRef.current;
      for (const [id, idx] of indexMap) {
        const point = pointArr[idx];
        if (!point) continue;

        if (!filter) {
          point.show = true;
        } else {
          const sat = satLookup.get(id);
          if (!sat) continue;
          point.show = matchesFilter(sat, filter);
        }
      }
    });

    // Color mode reactivity — recolor all points
    let prevColorMode = useSatelliteStore.getState().colorMode;
    unsubColorRef.current = useSatelliteStore.subscribe((state) => {
      if (state.colorMode === prevColorMode) return;
      prevColorMode = state.colorMode;

      const pointArr = pointArrayRef.current;
      const satLookup = satLookupRef.current;
      if (pointArr.length === 0) return;

      const indexMap = pointIndexMapRef.current;
      for (const [id, idx] of indexMap) {
        const point = pointArr[idx];
        const sat = satLookup.get(id);
        if (!point || !sat) continue;

        const rawColor = getColorForSatelliteRaw(sat, state.colorMode);
        point.color = new Cesium.Color(rawColor.red, rawColor.green, rawColor.blue, 1.0);
      }
    });

    // Debris visibility reactivity — immediately hide/show debris points
    let prevDebrisVisible = useAppStore.getState().debrisVisible;
    unsubDebrisRef.current = useAppStore.subscribe((state) => {
      if (state.debrisVisible === prevDebrisVisible) return;
      prevDebrisVisible = state.debrisVisible;

      const pointArr = pointArrayRef.current;
      const satLookup = satLookupRef.current;
      if (pointArr.length === 0) return;

      const indexMap = pointIndexMapRef.current;
      for (const [id, idx] of indexMap) {
        const point = pointArr[idx];
        const sat = satLookup.get(id);
        if (!point || !sat) continue;

        if (isDebris(sat)) {
          point.show = state.debrisVisible;
        }
      }
    });

    // Cleanup
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
      if (collectionRef.current && viewer && !viewer.isDestroyed()) {
        viewer.scene.primitives.remove(collectionRef.current);
      }
      collectionRef.current = null;
      if (unsubFilterRef.current) unsubFilterRef.current();
      if (unsubColorRef.current) unsubColorRef.current();
      if (unsubCatalogRef.current) unsubCatalogRef.current();
      if (unsubDebrisRef.current) unsubDebrisRef.current();
    };
  }, []);

  return null;
}

/**
 * Check if satellite matches the active filter.
 * Filters can be: { type: 'category', value: 'starlink' } or { type: 'country', value: 'US' }
 */
function matchesFilter(sat, filter) {
  if (!filter) return true;

  switch (filter.type) {
    case 'category':
      return sat.category === filter.value;
    case 'country':
      return sat.countryCode === filter.value;
    case 'objectType':
      return sat.objectType === filter.value;
    default:
      return true;
  }
}
