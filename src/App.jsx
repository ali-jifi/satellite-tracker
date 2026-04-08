import CesiumContainer from './components/Globe/CesiumContainer';
import TopBar from './components/UI/TopBar';
import MenuDrawer from './components/UI/MenuDrawer';
import SettingsPanel from './components/UI/SettingsPanel';
import ObserverLocation from './components/UI/ObserverLocation';
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

function App() {
  const isLoading = useAppStore((s) => s.isLoading);

  return (
    <>
      <CesiumContainer />
      {isLoading && <LoadingScreen />}
      <TopBar />
      {!isLoading && (
        <>
          <MenuDrawer />
          <SettingsPanel />
          <ObserverLocation />
        </>
      )}
    </>
  );
}

export default App;
