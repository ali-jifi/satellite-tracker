import { X } from 'lucide-react';
import useAppStore from '../../stores/appStore';
import useSatelliteStore from '../../stores/satelliteStore';
import { CATEGORY_COLORS } from '../../utils/colorModes';

const DEFAULT_COLOR = '#cccccc';

export default function BookmarkSection() {
  const bookmarks = useAppStore((s) => s.bookmarks);
  const toggleBookmark = useAppStore((s) => s.toggleBookmark);
  const satellites = useSatelliteStore((s) => s.satellites);
  const setDetailSatelliteId = useSatelliteStore((s) => s.setDetailSatelliteId);

  // Filter to only valid (existing) bookmarks
  const validBookmarks = bookmarks
    .filter((id) => satellites.has(id))
    .map((id) => satellites.get(id));

  if (validBookmarks.length === 0) return null;

  return (
    <div className="mb-4">
      <h3
        className="text-[10px] tracking-[0.2em] uppercase mb-2"
        style={{ color: 'var(--accent)', fontWeight: 600 }}
      >
        Bookmarks
      </h3>
      <div className="space-y-0.5">
        {validBookmarks.map((sat) => {
          const color = CATEGORY_COLORS[sat.category] || DEFAULT_COLOR;
          return (
            <div
              key={sat.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all duration-150 hover:bg-[var(--glass-hover)] group"
              onClick={() => setDetailSatelliteId(sat.id)}
            >
              {/* Category color dot */}
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: color }}
              />
              {/* Satellite info */}
              <div className="min-w-0 flex-1">
                <div
                  className="text-[11px] truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {sat.name}
                </div>
                <div
                  className="text-[9px] tabular-nums"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {sat.id}
                </div>
              </div>
              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBookmark(sat.id);
                }}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--glass-hover)]"
                title="Remove bookmark"
              >
                <X size={10} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
