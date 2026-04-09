import { useState, useEffect } from 'react';
import useAppStore from '../../stores/appStore';

const LOCALSTORAGE_KEY = 'spacetrack-creds';

function ToggleSwitch({ enabled, onToggle, disabled = false }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      }`}
      style={{
        background: enabled ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
      }}
      aria-label="Toggle"
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200"
        style={{
          transform: enabled ? 'translateX(16px)' : 'translateX(0)',
        }}
      />
    </button>
  );
}

function StatusDot({ active }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
      style={{ background: active ? '#38f3bf' : 'rgba(255,255,255,0.3)' }}
    />
  );
}

function SpaceTrackSection() {
  const spaceTrackCredentials = useAppStore((s) => s.spaceTrackCredentials);
  const setSpaceTrackCredentials = useAppStore((s) => s.setSpaceTrackCredentials);
  const setSpaceTrackEnabled = useAppStore((s) => s.setSpaceTrackEnabled);

  const [expanded, setExpanded] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALSTORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.identity && parsed.password) {
          setSpaceTrackCredentials(parsed);
          setSpaceTrackEnabled(true);
        }
      }
    } catch {
      // ignore corrupt localStorage
    }
  }, []);

  const isConfigured = !!spaceTrackCredentials;

  const handleSave = () => {
    if (!username.trim() || !password.trim()) return;
    const creds = { identity: username.trim(), password: password.trim() };
    setSpaceTrackCredentials(creds);
    setSpaceTrackEnabled(true);
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(creds));
    } catch {
      // storage full or unavailable
    }
    setUsername('');
    setPassword('');
  };

  const handleClear = () => {
    setSpaceTrackCredentials(null);
    setSpaceTrackEnabled(false);
    localStorage.removeItem(LOCALSTORAGE_KEY);
    setUsername('');
    setPassword('');
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-primary)',
  };

  return (
    <div>
      {/* Header row */}
      <button
        className="flex items-center justify-between w-full cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-xs flex items-center" style={{ color: 'var(--text-primary)' }}>
          <StatusDot active={isConfigured} />
          Space-Track
        </span>
        <span
          className="text-[10px] transition-transform duration-200"
          style={{
            color: 'var(--text-secondary)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          &#9662;
        </span>
      </button>

      {/* Expandable form */}
      {expanded && (
        <div className="mt-2 space-y-2">
          {isConfigured ? (
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: '#38f3bf' }}>
                Active
              </span>
              <button
                onClick={handleClear}
                className="text-[10px] px-2 py-0.5 rounded cursor-pointer"
                style={{
                  background: 'rgba(255,80,80,0.15)',
                  color: '#ff6b6b',
                  border: '1px solid rgba(255,80,80,0.2)',
                }}
              >
                Clear
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-xs rounded px-2 py-1.5 outline-none"
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs rounded px-2 py-1.5 outline-none"
                style={inputStyle}
              />
              <button
                onClick={handleSave}
                disabled={!username.trim() || !password.trim()}
                className="w-full text-[10px] rounded py-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: 'rgba(56,243,191,0.15)',
                  color: '#38f3bf',
                  border: '1px solid rgba(56,243,191,0.2)',
                }}
              >
                Save
              </button>
              <p className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>
                Optional. Requires a free space-track.org account.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPanel() {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const gridLinesVisible = useAppStore((s) => s.gridLinesVisible);
  const toggleGridLines = useAppStore((s) => s.toggleGridLines);
  const labelsVisible = useAppStore((s) => s.labelsVisible);
  const toggleLabelsVisible = useAppStore((s) => s.toggleLabelsVisible);
  const debrisVisible = useAppStore((s) => s.debrisVisible);
  const toggleDebrisVisible = useAppStore((s) => s.toggleDebrisVisible);
  const groundTracksVisible = useAppStore((s) => s.groundTracksVisible);
  const toggleGroundTracks = useAppStore((s) => s.toggleGroundTracks);
  const orbitLinesVisible = useAppStore((s) => s.orbitLinesVisible);
  const toggleOrbitLines = useAppStore((s) => s.toggleOrbitLines);
  const footprintsVisible = useAppStore((s) => s.footprintsVisible);
  const toggleFootprints = useAppStore((s) => s.toggleFootprints);

  if (!settingsOpen) return null;

  return (
    <div
      className="fixed top-16 right-4 z-30 glass rounded-xl p-4 fade-in"
      style={{ width: 260 }}
    >
      {/* Header */}
      <h3
        className="text-[10px] tracking-[0.2em] uppercase mb-4"
        style={{ color: 'var(--accent)', fontWeight: 600 }}
      >
        SETTINGS
      </h3>

      {/* Setting items */}
      <div className="space-y-3">
        {/* Grid Lines - active */}
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Grid Lines
          </span>
          <ToggleSwitch enabled={gridLinesVisible} onToggle={toggleGridLines} />
        </div>

        {/* Satellite Labels */}
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Satellite Labels
          </span>
          <ToggleSwitch enabled={labelsVisible} onToggle={toggleLabelsVisible} />
        </div>

        {/* Show Debris */}
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Show Debris
          </span>
          <ToggleSwitch enabled={debrisVisible} onToggle={toggleDebrisVisible} />
        </div>

        {/* Ground Tracks */}
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Ground Tracks
          </span>
          <ToggleSwitch enabled={groundTracksVisible} onToggle={toggleGroundTracks} />
        </div>

        {/* Orbit Lines */}
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Orbit Lines
          </span>
          <ToggleSwitch enabled={orbitLinesVisible} onToggle={toggleOrbitLines} />
        </div>

        {/* Visibility Footprints */}
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Visibility Footprints
          </span>
          <ToggleSwitch enabled={footprintsVisible} onToggle={toggleFootprints} />
        </div>

        {/* Atmosphere - placeholder */}
        <div className="flex items-center justify-between opacity-40">
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Atmosphere
          </span>
          <ToggleSwitch enabled={false} onToggle={() => {}} disabled />
        </div>

        {/* Clouds - placeholder */}
        <div className="flex items-center justify-between opacity-40">
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Clouds
          </span>
          <ToggleSwitch enabled={false} onToggle={() => {}} disabled />
        </div>
      </div>

      {/* Data Sources divider */}
      <div className="my-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

      {/* Data Sources section */}
      <h3
        className="text-[10px] tracking-[0.2em] uppercase mb-3"
        style={{ color: 'var(--accent)', fontWeight: 600 }}
      >
        DATA SOURCES
      </h3>

      <div className="space-y-3">
        {/* CelesTrak - always active */}
        <div className="flex items-center justify-between">
          <span className="text-xs flex items-center" style={{ color: 'var(--text-primary)' }}>
            <StatusDot active />
            CelesTrak
          </span>
          <span className="text-[10px]" style={{ color: '#38f3bf' }}>Active</span>
        </div>

        {/* Space-Track - configurable */}
        <SpaceTrackSection />
      </div>
    </div>
  );
}
