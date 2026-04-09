import { useEffect, useRef } from 'react';

/**
 * Global keyboard shortcut hook with input field guard.
 * Accepts a stable shortcuts map: { key: handler }
 * Ignores shortcuts when activeElement is INPUT/TEXTAREA/contentEditable (except Escape).
 */
export default function useKeyboardShortcuts(shortcutsMap) {
  const mapRef = useRef(shortcutsMap);
  mapRef.current = shortcutsMap;

  useEffect(() => {
    function handleKeyDown(e) {
      const map = mapRef.current;
      if (!map) return;

      // Guard: ignore shortcuts when typing in input fields (except Escape)
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
