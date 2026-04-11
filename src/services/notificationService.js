import { JulianDate } from 'cesium';
import useAppStore from '../stores/appStore';

// toast event system
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

// subscribe to toast events, returns unsub fn
export function onToast(cb) {
  toastListeners.add(cb);
  return () => toastListeners.delete(cb);
}

// request browser notif permission
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

// send in-app toast, also fires native notif if granted and page is hidden
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

// schedule notif to fire leadTimeMs before event
// uses CesiumJS sim-time polling for accel playback, falls back to wall-clock setTimeout
export function scheduleEventNotification(event, leadTimeMs) {
  const fireAt = event.time.getTime() - leadTimeMs;
  const viewer = useAppStore.getState().viewerRef;

  if (viewer && viewer.clock) {
    // sim-time polling approach
    const nowSim = JulianDate.toDate(viewer.clock.currentTime).getTime();
    if (fireAt <= nowSim) return null;

    const intervalId = setInterval(() => {
      const v = useAppStore.getState().viewerRef;
      if (!v || !v.clock) return;
      const simNow = JulianDate.toDate(v.clock.currentTime).getTime();
      if (simNow >= fireAt) {
        clearInterval(intervalId);
        sendNotification(event.title, event.body);
      }
    }, 500);

    return intervalId;
  }

  // fallback: no viewer, use wall-clock
  const delay = fireAt - Date.now();
  if (delay <= 0) return null;
  return setTimeout(() => {
    sendNotification(event.title, event.body);
  }, delay);
}
