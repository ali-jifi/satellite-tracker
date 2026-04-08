import { MapPin, Minus } from 'lucide-react';
import useAppStore from '../../stores/appStore';

const SECTIONS = [
  {
    title: 'EXPLORE',
    items: [
      { label: 'All Satellites', active: false },
      { label: 'By Category', active: false },
      { label: 'By Country', active: false },
    ],
  },
  {
    title: 'ANALYZE',
    items: [
      { label: 'Constellations', active: false },
      { label: 'Re-entry Predictor', active: false },
      { label: 'Close Approaches', active: false },
    ],
  },
  {
    title: 'VIEW',
    items: [
      { label: 'Observer Location', active: true, action: 'openLocationPrompt' },
      { label: 'Ground Observer', active: false },
    ],
  },
];

export default function MenuDrawer() {
  const menuOpen = useAppStore((s) => s.menuOpen);
  const openLocationPrompt = useAppStore((s) => s.openLocationPrompt);

  const handleItemClick = (item) => {
    if (!item.active) return;
    if (item.action === 'openLocationPrompt') {
      openLocationPrompt();
    }
  };

  return (
    <div
      className="fixed left-0 top-0 bottom-0 z-30 glass custom-scroll overflow-y-auto"
      style={{
        width: 280,
        transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Top padding to avoid TopBar */}
      <div className="pt-16 px-4 pb-6">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-6">
            {/* Section header */}
            <h3
              className="text-[10px] tracking-[0.2em] uppercase mb-3"
              style={{ color: 'var(--accent)', fontWeight: 600 }}
            >
              {section.title}
            </h3>

            {/* Items */}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.label}>
                  <button
                    onClick={() => handleItemClick(item)}
                    disabled={!item.active}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center gap-2 transition-all duration-150 ${
                      item.active
                        ? 'opacity-100 cursor-pointer hover:bg-[var(--glass-hover)] hover:border-l-2 hover:border-l-[var(--accent)]'
                        : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    {item.active ? (
                      <MapPin size={13} style={{ color: 'var(--accent)' }} />
                    ) : (
                      <Minus size={13} style={{ color: 'var(--text-secondary)' }} />
                    )}
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
