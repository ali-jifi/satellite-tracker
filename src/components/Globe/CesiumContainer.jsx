import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import {
  GLOBE_BASE_COLOR,
  BLOOM_CONFIG,
  DEFAULT_CAMERA,
  REVEAL_START,
  REVEAL_DURATION,
  MIN_ZOOM_DISTANCE,
  MAX_ZOOM_DISTANCE,
  GLOBE_STYLES,
} from './GlobeConfig';
import useAppStore from '../../stores/appStore';
import useSatelliteStore from '../../stores/satelliteStore';
import { fetchAllSatellites, startBackgroundPolling } from '../../services/celestrakService';
import { startPropagation, stopPropagation, refreshWorkerData } from '../../services/propagationService';
import spaceTrackService from '../../services/spaceTrackService';

/**
 * Attempt to fetch supplementary data from Space-Track.
 * Non-blocking: logs warning on failure, never throws.
 */
async function fetchSpaceTrackData() {
  const { spaceTrackEnabled, spaceTrackCredentials } = useAppStore.getState();
  if (!spaceTrackEnabled || !spaceTrackCredentials) return;

  try {
    spaceTrackService.setCredentials(
      spaceTrackCredentials.identity,
      spaceTrackCredentials.password
    );
    await spaceTrackService.login();
    const satellites = await spaceTrackService.getAllActiveTLEs(500);
    if (satellites.length > 0) {
      useSatelliteStore.getState().addSatellites(satellites);
      refreshWorkerData();
      console.log(`[SpaceTrack] Merged ${satellites.length} supplementary satellites`);
    }
  } catch (err) {
    console.warn('[SpaceTrack] Failed to fetch supplementary data:', err.message);
  }
}

/**
 * Apply a globe style by swapping base imagery and adjusting globe properties.
 * Preserves the grid layer if present.
 */
function applyGlobeStyle(viewer, style, gridLayerRef, cloudLayerRef) {
  const config = GLOBE_STYLES[style] || GLOBE_STYLES.photo;
  const layers = viewer.imageryLayers;

  // Remember grid layer state
  const gridLayer = gridLayerRef.current;

  // Remove all layers except grid
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers.get(i);
    if (layer !== gridLayer) {
      layers.remove(layer, true);
    }
  }

  // Cloud layer was removed; clear the ref so the clouds effect can re-add it
  if (cloudLayerRef) cloudLayerRef.current = null;

  // Add new base tiles at index 0 (below grid)
  const baseTiles = new Cesium.UrlTemplateImageryProvider({
    url: config.tileUrl,
    subdomains: ['a', 'b', 'c', 'd'],
    credit: new Cesium.Credit('CartoDB'),
    minimumLevel: 0,
    maximumLevel: 18,
  });
  const baseLayer = layers.addImageryProvider(baseTiles, 0);
  baseLayer.alpha = config.tileAlpha;

  // Apply globe properties
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(config.baseColor);
  viewer.scene.globe.enableLighting = config.enableLighting;
}

export default function CesiumContainer() {
  const containerRef = useRef(null);
  const initialized = useRef(false);
  const viewerInstance = useRef(null);
  const gridLayerRef = useRef(null);
  const cloudLayerRef = useRef(null);
  const setViewerRef = useAppStore((s) => s.setViewerRef);
  const setLoading = useAppStore((s) => s.setLoading);
  const observerLocation = useAppStore((s) => s.observerLocation);
  const gridLinesVisible = useAppStore((s) => s.gridLinesVisible);
  const globeStyle = useAppStore((s) => s.globeStyle);
  const atmosphereEnabled = useAppStore((s) => s.atmosphereEnabled);
  const cloudsEnabled = useAppStore((s) => s.cloudsEnabled);

  useEffect(() => {
    // Guard against React Strict Mode double-mount
    if (initialized.current) return;
    initialized.current = true;

    let viewer;

    async function initViewer() {
      viewer = new Cesium.Viewer(containerRef.current, {
        baseLayer: false,
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        infoBox: false,
        selectionIndicator: false,
        fullscreenButton: false,
        shouldAnimate: true,
      });

      // Dark map tile layer (CartoDB Dark Matter — roads, cities, labels)
      const darkTiles = new Cesium.UrlTemplateImageryProvider({
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        subdomains: ['a', 'b', 'c', 'd'],
        credit: new Cesium.Credit('CartoDB'),
        minimumLevel: 0,
        maximumLevel: 18,
      });
      viewer.imageryLayers.addImageryProvider(darkTiles);

      // Globe appearance
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(GLOBE_BASE_COLOR);
      viewer.scene.globe.enableLighting = true;
      viewer.scene.backgroundColor = Cesium.Color.BLACK;
      viewer.scene.skyAtmosphere.show = false;
      viewer.scene.globe.showGroundAtmosphere = false;
      viewer.scene.sun.glowFactor = 0.0;

      // Bloom post-processing
      const bloom = viewer.scene.postProcessStages.bloom;
      bloom.enabled = BLOOM_CONFIG.enabled;
      bloom.uniforms.contrast = BLOOM_CONFIG.contrast;
      bloom.uniforms.brightness = BLOOM_CONFIG.brightness;
      bloom.uniforms.delta = BLOOM_CONFIG.delta;
      bloom.uniforms.sigma = BLOOM_CONFIG.sigma;
      bloom.uniforms.stepSize = BLOOM_CONFIG.stepSize;

      // Zoom limits
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = MIN_ZOOM_DISTANCE;
      viewer.scene.screenSpaceCameraController.maximumZoomDistance = MAX_ZOOM_DISTANCE;

      // Grid lines layer (hidden by default)
      const gridProvider = new Cesium.GridImageryProvider({
        cells: 8,
        color: Cesium.Color.fromCssColorString('rgba(255, 255, 255, 0.08)'),
        glowColor: Cesium.Color.fromCssColorString('rgba(255, 255, 255, 0.02)'),
        glowWidth: 2,
        backgroundColor: Cesium.Color.TRANSPARENT,
      });
      const gridLayer = viewer.imageryLayers.addImageryProvider(gridProvider);
      gridLayer.show = false;
      gridLayerRef.current = gridLayer;

      // Set initial camera to deep space (reveal start)
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          REVEAL_START.destination.lon,
          REVEAL_START.destination.lat,
          REVEAL_START.destination.height
        ),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
        },
      });

      // Store viewer ref locally and in zustand
      viewerInstance.current = viewer;
      setViewerRef(viewer);

      // Zoom-in reveal animation
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          DEFAULT_CAMERA.destination.lon,
          DEFAULT_CAMERA.destination.lat,
          DEFAULT_CAMERA.destination.height
        ),
        duration: REVEAL_DURATION,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
        complete: () => setLoading(false),
      });
    }

    let stopPolling = null;

    initViewer().then(() => {
      // Bootstrap data pipeline: fetch catalog -> start propagation -> poll
      fetchAllSatellites((count) => {
        useSatelliteStore.getState().setLoadProgress(count);
      }).then((catalog) => {
        const satArray = Array.from(catalog.values());
        useSatelliteStore.getState().addSatellites(satArray);
        useSatelliteStore.getState().setCatalogLoaded(true);
        console.log(`[CesiumContainer] Catalog loaded: ${catalog.size} satellites`);

        // Supplementary Space-Track fetch (non-blocking)
        fetchSpaceTrackData();

        startPropagation();

        stopPolling = startBackgroundPolling(async () => {
          const refreshed = await fetchAllSatellites();
          const refreshArray = Array.from(refreshed.values());
          useSatelliteStore.getState().addSatellites(refreshArray);
          refreshWorkerData();
        });
      });
    });

    // Subscribe to Space-Track credential changes for live activation
    let prevSpaceTrackEnabled = useAppStore.getState().spaceTrackEnabled;
    const unsubSpaceTrack = useAppStore.subscribe((state) => {
      if (state.spaceTrackEnabled === prevSpaceTrackEnabled) return;
      prevSpaceTrackEnabled = state.spaceTrackEnabled;
      if (state.spaceTrackEnabled) fetchSpaceTrackData();
    });

    return () => {
      stopPropagation();
      if (stopPolling) stopPolling();
      unsubSpaceTrack();
      if (viewer && !viewer.isDestroyed()) {
        setViewerRef(null);
        viewerInstance.current = null;
        viewer.destroy();
      }
      initialized.current = false;
    };
  }, []);

  // Observer marker and fly-to reactivity
  useEffect(() => {
    if (!viewerInstance.current || !observerLocation) return;
    const viewer = viewerInstance.current;

    // Remove previous observer entities
    ['observer-dot', 'observer-ring-0', 'observer-ring-1', 'observer-ring-2', 'observer-crosshair-ns', 'observer-crosshair-ew'].forEach((id) => {
      const existing = viewer.entities.getById(id);
      if (existing) viewer.entities.remove(existing);
    });

    const position = Cesium.Cartesian3.fromDegrees(observerLocation.lon, observerLocation.lat);

    // Center dot
    viewer.entities.add({
      id: 'observer-dot',
      position,
      point: {
        pixelSize: 8,
        color: Cesium.Color.fromCssColorString('#38f3bf'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
      },
    });

    // Concentric visibility circles using polyline circles
    const accentColor = Cesium.Color.fromCssColorString('#38f3bf');
    const circleRadii = [200_000, 500_000, 1_000_000]; // meters
    circleRadii.forEach((radius, i) => {
      const circlePoints = [];
      const numSegments = 64;
      for (let s = 0; s <= numSegments; s++) {
        const angle = (s / numSegments) * Math.PI * 2;
        // Approximate circle on globe surface using offset degrees
        const dLat = (radius / 111320) * Math.cos(angle);
        const dLon = (radius / (111320 * Math.cos(observerLocation.lat * Math.PI / 180))) * Math.sin(angle);
        circlePoints.push(observerLocation.lon + dLon, observerLocation.lat + dLat);
      }
      viewer.entities.add({
        id: `observer-ring-${i}`,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(circlePoints),
          width: 1.5,
          material: accentColor.withAlpha(0.4 - i * 0.1),
        },
      });
    });

    // Crosshair lines through observer (N-S and E-W)
    const crosshairExtent = 12; // degrees from center
    viewer.entities.add({
      id: 'observer-crosshair-ns',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([
          observerLocation.lon, observerLocation.lat - crosshairExtent,
          observerLocation.lon, observerLocation.lat + crosshairExtent,
        ]),
        width: 1,
        material: accentColor.withAlpha(0.25),
      },
    });
    viewer.entities.add({
      id: 'observer-crosshair-ew',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([
          observerLocation.lon - crosshairExtent, observerLocation.lat,
          observerLocation.lon + crosshairExtent, observerLocation.lat,
        ]),
        width: 1,
        material: accentColor.withAlpha(0.25),
      },
    });

    // Fly to observer at ~2000km altitude
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        observerLocation.lon,
        observerLocation.lat,
        2_000_000
      ),
      duration: 1.5,
    });
  }, [observerLocation]);

  // Grid lines toggle reactivity
  useEffect(() => {
    if (gridLayerRef.current) {
      gridLayerRef.current.show = gridLinesVisible;
    }
  }, [gridLinesVisible]);

  // Globe style switching
  useEffect(() => {
    if (!viewerInstance.current) return;
    applyGlobeStyle(viewerInstance.current, globeStyle, gridLayerRef, cloudLayerRef);
  }, [globeStyle]);

  // Atmosphere toggle
  useEffect(() => {
    if (!viewerInstance.current) return;
    const viewer = viewerInstance.current;
    viewer.scene.skyAtmosphere.show = atmosphereEnabled;
    viewer.scene.globe.showGroundAtmosphere = atmosphereEnabled;
    viewer.scene.fog.enabled = atmosphereEnabled;
  }, [atmosphereEnabled]);

  // Cloud layer (NASA GIBS WMTS)
  useEffect(() => {
    if (!viewerInstance.current) return;
    const viewer = viewerInstance.current;
    const layers = viewer.imageryLayers;

    if (cloudsEnabled) {
      // Use yesterday's date (today's imagery may not be available yet)
      const yesterday = new Date(Date.now() - 86400000);
      const dateStr = yesterday.toISOString().split('T')[0];

      try {
        const cloudProvider = new Cesium.WebMapTileServiceImageryProvider({
          url: 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi',
          layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
          style: 'default',
          tileMatrixSetID: '250m',
          format: 'image/jpeg',
          tilingScheme: new Cesium.GeographicTilingScheme(),
          tileWidth: 256,
          tileHeight: 256,
          maximumLevel: 8,
          times: new Cesium.TimeIntervalCollection([
            new Cesium.TimeInterval({
              start: Cesium.JulianDate.fromIso8601(dateStr),
              stop: Cesium.JulianDate.fromIso8601(dateStr),
            }),
          ]),
          clock: viewer.clock,
        });

        // Add cloud layer on top of base tiles but below grid
        const gridLayer = gridLayerRef.current;
        let insertIndex = layers.length;
        if (gridLayer) {
          insertIndex = layers.indexOf(gridLayer);
          if (insertIndex < 0) insertIndex = layers.length;
        }

        const cloudLayer = layers.addImageryProvider(cloudProvider, insertIndex);
        cloudLayer.alpha = 0.5;
        cloudLayerRef.current = cloudLayer;
      } catch (err) {
        console.warn('[CesiumContainer] Failed to add cloud layer:', err.message);
      }
    } else {
      // Remove cloud layer if it exists
      if (cloudLayerRef.current) {
        try {
          layers.remove(cloudLayerRef.current, true);
        } catch {
          // layer may already be removed
        }
        cloudLayerRef.current = null;
      }
    }
  }, [cloudsEnabled, globeStyle]);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
  );
}
