import CesiumContainer from './components/Globe/CesiumContainer';
import SatelliteRenderer from './components/Globe/SatelliteRenderer';
import SelectedSatelliteManager from './components/Globe/SelectedSatelliteManager';
import CameraManager from './components/Globe/CameraManager';
import SkyDomeView from './components/SkyDome/SkyDomeView';
import TopBar from './components/UI/TopBar';
import MenuDrawer from './components/UI/MenuDrawer';
import SettingsPanel from './components/UI/SettingsPanel';
import ObserverLocation from './components/UI/ObserverLocation';
import TimeWidget from './components/UI/TimeWidget';
import DetailPanel from './components/UI/DetailPanel';
import KeyboardShortcuts from './components/UI/KeyboardShortcuts';
import ShortcutHelpOverlay from './components/UI/ShortcutHelpOverlay';
import ReentryPanel from './components/UI/ReentryPanel';
import TleAnalyzerPanel from './components/UI/TleAnalyzerPanel';
import ConstellationDashboard from './components/UI/ConstellationDashboard';
import PhotobombPanel from './components/UI/PhotobombPanel';
import ToastContainer from './components/UI/ToastContainer';
import AnalysisVisualizationManager from './components/Globe/AnalysisVisualizationManager';
import useUrlSync from './hooks/useUrlSync';
import useAppStore from './stores/appStore';

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div
        className="w-8 h-8 border-2 border-transparent rounded-full animate-spin"
        style={{
          borderTopColor: 'var(--accent)',
          borderRightColor: 'var(--accent)',
          animationDuration: '1.2s',
        }}
      />
    </div>
  );
}

function UrlSync() {
  useUrlSync();
  return null;
}

function App() {
  const isLoading = useAppStore((s) => s.isLoading);

  return (
    <>
      <CesiumContainer />
      {isLoading && <LoadingScreen />}
      <SkyDomeView />
      <TopBar />
      {!isLoading && (
        <>
          <SatelliteRenderer />
          <SelectedSatelliteManager />
          <CameraManager />
          <MenuDrawer />
          <SettingsPanel />
          <ObserverLocation />
          <TimeWidget />
          <DetailPanel />
          <ReentryPanel />
          <TleAnalyzerPanel />
          <ConstellationDashboard />
          <PhotobombPanel />
          <AnalysisVisualizationManager />
          <KeyboardShortcuts />
          <UrlSync />
        </>
      )}
      <ShortcutHelpOverlay />
      <ToastContainer />
    </>
  );
}

export default App;
