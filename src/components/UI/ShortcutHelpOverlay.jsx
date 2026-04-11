import useAppStore from '../../stores/appStore';

const SECTIONS = [
  {
    title: 'Camera Modes',
    shortcuts: [
      { key: '1', desc: 'Free camera' },
      { key: '2', desc: 'Follow satellite' },
      { key: '3', desc: 'First-person (POV)' },
      { key: '4', desc: 'Sky Dome (observer)' },
    ],
  },
  {
    title: 'Overlays',
    shortcuts: [
      { key: 'G', desc: 'Ground tracks' },
      { key: 'O', desc: 'Orbit lines' },
      { key: 'F', desc: 'Footprints' },
      { key: 'L', desc: 'Labels' },
      { key: 'D', desc: 'Debris' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { key: 'Space', desc: 'Open search' },
      { key: 'Esc', desc: 'Exit / Deselect' },
      { key: 'B', desc: 'Bookmark satellite' },
      { key: 'N', desc: 'Next bookmark' },
      { key: 'P', desc: 'Previous bookmark' },
    ],
  },
  {
    title: 'Other',
    shortcuts: [
      { key: 'H', desc: 'Toggle HUD (POV)' },
      { key: '?', desc: 'This help' },
    ],
  },
];

function Kbd({ children }) {
  return (
    <span
      className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-semibold min-w-[22px]"
      style={{
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        color: 'var(--accent)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {children}
    </span>
  );
}

export default function ShortcutHelpOverlay() {
  const shortcutHelpOpen = useAppStore((s) => s.shortcutHelpOpen);
  const toggleShortcutHelp = useAppStore((s) => s.toggleShortcutHelp);

  if (!shortcutHelpOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={toggleShortcutHelp}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* modal */}
      <div
        className="glass relative z-10 rounded-lg px-6 py-5 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-sm tracking-[0.2em] uppercase mb-4 text-center"
          style={{ color: 'var(--accent)', fontWeight: 600 }}
        >
          Keyboard Shortcuts
        </h2>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3
                className="text-[9px] tracking-[0.15em] uppercase mb-2"
                style={{ color: 'var(--text-secondary)', fontWeight: 600 }}
              >
                {section.title}
              </h3>
              <div className="space-y-1.5">
                {section.shortcuts.map((s) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <Kbd>{s.key}</Kbd>
                    <span
                      className="text-[11px]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {s.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-4 text-center text-[10px]"
          style={{ color: 'var(--text-secondary)' }}
        >
          Press <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close
        </div>
      </div>
    </div>
  );
}
