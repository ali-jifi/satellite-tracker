import { MapPin } from 'lucide-react';
import useAppStore from '../../stores/appStore';
import SearchBar from './SearchBar';
import SelectedPanel from './SelectedPanel';
import BookmarkSection from './BookmarkSection';
import CategoryTree from './CategoryTree';

export default function MenuDrawer() {
  const menuOpen = useAppStore((s) => s.menuOpen);
  const openLocationPrompt = useAppStore((s) => s.openLocationPrompt);

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
        {/* Search bar -- always visible */}
        <SearchBar />

        {/* Selected satellites panel -- visible when satellites selected */}
        <SelectedPanel />

        {/* Bookmarked satellites -- visible when bookmarks exist */}
        <BookmarkSection />

        {/* Category tree -- always visible, scrollable */}
        <CategoryTree />

        {/* VIEW section */}
        <div className="mt-6">
          <h3
            className="text-[10px] tracking-[0.2em] uppercase mb-3"
            style={{ color: 'var(--accent)', fontWeight: 600 }}
          >
            View
          </h3>
          <ul className="space-y-0.5">
            <li>
              <button
                onClick={openLocationPrompt}
                className="w-full text-left px-3 py-2 rounded-md text-xs flex items-center gap-2 transition-all duration-150 opacity-100 cursor-pointer hover:bg-[var(--glass-hover)] hover:border-l-2 hover:border-l-[var(--accent)]"
              >
                <MapPin size={13} style={{ color: 'var(--accent)' }} />
                <span>Observer Location</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
