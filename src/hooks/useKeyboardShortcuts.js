import { useEffect, useRef } from 'react';

// global keyboard shortcut hook w/ input field guard
// accepts { key: handler } map, ignores when in INPUT/TEXTAREA/contentEditable (except Escape)
export default function useKeyboardShortcuts(shortcutsMap) {
  const mapRef = useRef(shortcutsMap);
  mapRef.current = shortcutsMap;

  useEffect(() => {
    function handleKeyDown(e) {
      const map = mapRef.current;
      if (!map) return;

      // skip shortcuts when typing in inputs (except Escape)
      const tag = document.activeElement?.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        document.activeElement?.contentEditable === 'true';

      const key = e.key;

      if (isEditable && key !== 'Escape') return;

      const handler = map[key];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
