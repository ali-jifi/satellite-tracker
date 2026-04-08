import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import {
  DARK_OCEAN_COLOR,
  COASTLINE_COLOR,
  COASTLINE_WIDTH,
  BLOOM_CONFIG,
  DEFAULT_CAMERA,
  REVEAL_START,
  REVEAL_DURATION,
  MIN_ZOOM_DISTANCE,
  MAX_ZOOM_DISTANCE,
} from './GlobeConfig';
import useAppStore from '../../stores/appStore';

export default function CesiumContainer() {
  const containerRef = useRef(null);
  const initialized = useRef(false);
  const setViewerRef = useAppStore((s) => s.setViewerRef);
  const setLoading = useAppStore((s) => s.setLoading);

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

      // Dark globe appearance
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(DARK_OCEAN_COLOR);
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

      // Load GeoJSON coastlines
      const coastlines = await Cesium.GeoJsonDataSource.load(
        '/data/ne_110m_coastline.geojson',
        {
          stroke: Cesium.Color.fromCssColorString(COASTLINE_COLOR),
          strokeWidth: COASTLINE_WIDTH,
          clampToGround: true,
        }
      );
      viewer.dataSources.add(coastlines);

      // Load GeoJSON country borders
      const borders = await Cesium.GeoJsonDataSource.load(
        '/data/ne_110m_admin_0_boundary_lines_land.geojson',
        {
          stroke: Cesium.Color.fromCssColorString(COASTLINE_COLOR),
          strokeWidth: COASTLINE_WIDTH,
          clampToGround: true,
        }
      );
      viewer.dataSources.add(borders);

      // Store viewer ref in zustand
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

    initViewer();

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        setViewerRef(null);
        viewer.destroy();
      }
      initialized.current = false;
    };
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
  );
}
