// Toast event system
const toastListeners = new Set();

function dispatchToast(toast) {
  const enriched = {
    ...toast,
    id: Date.now(),
    expiresAt: Date.now() + 5000,
  };
  for (const cb of toastListeners) {
    cb(enriched);
  }
}

/**
 * Subscribe to toast events.
 * @param {Function} cb - callback receiving toast objects
 * @returns {Function} unsubscribe
 */
export function onToast(cb) {
  toastListeners.add(cb);
  return () => toastListeners.delete(cb);
}

/**
 * Request browser notification permission.
 * @returns {Promise<string>} 'granted' | 'denied' | 'default' | 'unsupported'
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

/**
 * Send an in-app toast notification. If browser notifications are granted
 * and the page is hidden, also fire a native Notification.
 * @param {string} title
 * @param {string} body
 * @param {object} options - optional: { tag }
 */
export function sendNotification(title, body, options = {}) {
  dispatchToast({ title, body });

  if (
    'Notification' in window &&
    Notification.permission === 'granted' &&
    document.hidden
  ) {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: options.tag || 'sat-tracker',
    });
  }
}

/**
 * Schedule a notification to fire `leadTimeMs` before an event.
 * @param {{ time: Date, title: string, body: string }} event
 * @param {number} leadTimeMs
 * @returns {number|null} timeoutId for cleanup, or null if already past
 */
export function scheduleEventNotification(event, leadTimeMs) {
  const fireAt = event.time.getTime() - leadTimeMs;
  const delay = fireAt - Date.now();
  if (delay <= 0) return null;
  return setTimeout(() => {
    sendNotification(event.title, event.body);
  }, delay);
}
