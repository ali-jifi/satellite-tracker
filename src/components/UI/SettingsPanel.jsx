import useAppStore from '../../stores/appStore';

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

export default function SettingsPanel() {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const gridLinesVisible = useAppStore((s) => s.gridLinesVisible);
  const toggleGridLines = useAppStore((s) => s.toggleGridLines);
  const labelsVisible = useAppStore((s) => s.labelsVisible);
  const toggleLabelsVisible = useAppStore((s) => s.toggleLabelsVisible);
  const debrisVisible = useAppStore((s) => s.debrisVisible);
  const toggleDebrisVisible = useAppStore((s) => s.toggleDebrisVisible);

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
    </div>
  );
}
