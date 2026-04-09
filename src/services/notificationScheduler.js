import useAnalysisStore from '../stores/analysisStore';
import { scheduleEventNotification } from './notificationService';

// Active timeout IDs grouped by category for cleanup
const activeTimeouts = {
  reentry: new Map(),
  closeApproach: new Map(),
  transit: new Map(),
};

// Zustand unsubscribe functions
const unsubscribers = [];

/**
 * Format a millisecond duration as human-readable lead time.
 * @param {number} ms
 * @returns {string}
 */
function formatLeadTime(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'less than a minute';
  if (minutes === 1) return '1 minute';
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return '1 hour';
  return `${hours} hours`;
}

/**
 * Clear all timeouts in a category map.
 * @param {Map} map
 */
function clearCategory(map) {
  for (const timeoutId of map.values()) {
    clearTimeout(timeoutId);
  }
  map.clear();
}

/**
 * Schedule re-entry notifications from current results.
 */
function scheduleReentryNotifications() {
  const { reentryResults, notificationPrefs } = useAnalysisStore.getState();
  clearCategory(activeTimeouts.reentry);

  if (!notificationPrefs.reentryEnabled) return;

  const leadTimeMs = notificationPrefs.leadTimeMinutes * 60000;
  const now = Date.now();

  for (const entry of reentryResults) {
    const eventTime = entry.predictedDate instanceof Date
      ? entry.predictedDate
      : new Date(entry.predictedDate);

    if (eventTime.getTime() <= now) continue;

    const tag = `reentry-${entry.satelliteId}`;
    const leadStr = formatLeadTime(leadTimeMs);
    const timeoutId = scheduleEventNotification(
      {
        time: eventTime,
        title: 'Re-entry Alert',
        body: `${entry.name} predicted to re-enter in ${leadStr}`,
      },
      leadTimeMs
    );

    if (timeoutId !== null) {
      activeTimeouts.reentry.set(tag, timeoutId);
    }
  }
}

/**
 * Schedule close approach notifications from current results.
 */
function scheduleCloseApproachNotifications() {
  const { closeApproachResults, notificationPrefs } = useAnalysisStore.getState();
  clearCategory(activeTimeouts.closeApproach);

  if (!notificationPrefs.closeApproachEnabled) return;

  const leadTimeMs = notificationPrefs.leadTimeMinutes * 60000;
  const now = Date.now();

  for (const entry of closeApproachResults) {
    // time may be a ms timestamp or Date
    const eventTime = entry.time instanceof Date
      ? entry.time
      : new Date(entry.time);

    if (eventTime.getTime() <= now) continue;

    const tag = `approach-${entry.satelliteId}`;
    const distStr = entry.distanceKm != null ? entry.distanceKm.toFixed(1) : '?';
    const leadStr = formatLeadTime(leadTimeMs);
    const timeoutId = scheduleEventNotification(
      {
        time: eventTime,
        title: 'Close Approach',
        body: `${entry.name} within ${distStr} km in ${leadStr}`,
      },
      leadTimeMs
    );

    if (timeoutId !== null) {
      activeTimeouts.closeApproach.set(tag, timeoutId);
    }
  }
}

/**
 * Schedule photobomb transit notifications from current results.
 */
function scheduleTransitNotifications() {
  const { transitResults, notificationPrefs } = useAnalysisStore.getState();
  clearCategory(activeTimeouts.transit);

  if (!notificationPrefs.photobombEnabled) return;

  const leadTimeMs = notificationPrefs.leadTimeMinutes * 60000;
  const now = Date.now();

  for (const entry of transitResults) {
    const eventTime = entry.time instanceof Date
      ? entry.time
      : new Date(entry.time);

    if (eventTime.getTime() <= now) continue;

    const tag = `transit-${entry.satelliteId}-${eventTime.getTime()}`;
    const leadStr = formatLeadTime(leadTimeMs);
    const timeoutId = scheduleEventNotification(
      {
        time: eventTime,
        title: 'Photobomb Alert',
        body: `${entry.name} transiting ${entry.targetBody} in ${leadStr}`,
      },
      leadTimeMs
    );

    if (timeoutId !== null) {
      activeTimeouts.transit.set(tag, timeoutId);
    }
  }
}

// Track previous state references for change detection
let prevReentryResults = null;
let prevCloseApproachResults = null;
let prevTransitResults = null;
let prevNotificationPrefs = null;

/**
 * Start the notification scheduler.
 * Subscribes to analysis store result changes and schedules notifications.
 */
export function startNotificationScheduler() {
  const state = useAnalysisStore.getState();
  prevReentryResults = state.reentryResults;
  prevCloseApproachResults = state.closeApproachResults;
  prevTransitResults = state.transitResults;
  prevNotificationPrefs = state.notificationPrefs;

  // Single subscription with manual change detection
  const unsub = useAnalysisStore.subscribe((state) => {
    let changed = false;

    if (state.reentryResults !== prevReentryResults) {
      prevReentryResults = state.reentryResults;
      scheduleReentryNotifications();
      changed = true;
    }

    if (state.closeApproachResults !== prevCloseApproachResults) {
      prevCloseApproachResults = state.closeApproachResults;
      scheduleCloseApproachNotifications();
      changed = true;
    }

    if (state.transitResults !== prevTransitResults) {
      prevTransitResults = state.transitResults;
      scheduleTransitNotifications();
      changed = true;
    }

    if (state.notificationPrefs !== prevNotificationPrefs) {
      prevNotificationPrefs = state.notificationPrefs;
      // Reschedule all categories when prefs change
      if (!changed) {
        scheduleReentryNotifications();
        scheduleCloseApproachNotifications();
        scheduleTransitNotifications();
      }
    }
  });

  unsubscribers.push(unsub);

  // Initial schedule from any existing results
  scheduleReentryNotifications();
  scheduleCloseApproachNotifications();
  scheduleTransitNotifications();
}

/**
 * Stop the notification scheduler.
 * Clears all timeouts and unsubscribes from store.
 */
export function stopNotificationScheduler() {
  clearCategory(activeTimeouts.reentry);
  clearCategory(activeTimeouts.closeApproach);
  clearCategory(activeTimeouts.transit);

  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers.length = 0;

  prevReentryResults = null;
  prevCloseApproachResults = null;
  prevTransitResults = null;
  prevNotificationPrefs = null;
}
