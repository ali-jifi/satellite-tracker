import { useState, useCallback } from 'react';
import useAnalysisStore from '../../stores/analysisStore';
import { requestNotificationPermission } from '../../services/notificationService';

const LEAD_TIME_OPTIONS = [1, 5, 10, 15, 30];

function ToggleRow({ label, enabled, onToggle }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
        {label}
      </span>
      <button
        onClick={onToggle}
        className="relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer"
        style={{
          background: enabled ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
        }}
        aria-label={`Toggle ${label}`}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200"
          style={{
            transform: enabled ? 'translateX(16px)' : 'translateX(0)',
          }}
        />
      </button>
    </div>
  );
}

function PermissionStatus({ permission }) {
  if (permission === 'granted') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#38f3bf' }} />
        <span className="text-[10px]" style={{ color: '#38f3bf' }}>Enabled</span>
      </div>
    );
  }
  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#ff6b6b' }} />
        <span className="text-[10px]" style={{ color: '#ff6b6b' }}>
          Blocked — reset in browser settings
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#f0c040' }} />
      <span className="text-[10px]" style={{ color: '#f0c040' }}>Not yet requested</span>
    </div>
  );
}

export default function NotificationSettings() {
  const notificationPrefs = useAnalysisStore((s) => s.notificationPrefs);
  const setNotificationPrefs = useAnalysisStore((s) => s.setNotificationPrefs);

  const [permission, setPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const handleRequestPermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    if (result !== 'unsupported') {
      setPermission(result);
    }
  }, []);

  const updatePref = useCallback(
    (key, value) => {
      setNotificationPrefs({ ...notificationPrefs, [key]: value });
    },
    [notificationPrefs, setNotificationPrefs]
  );

  const isGranted = permission === 'granted';

  return (
    <div>
      <PermissionStatus permission={permission} />

      {permission === 'default' && (
        <div className="mt-2">
          <p className="text-[9px] mb-2" style={{ color: 'var(--text-secondary)' }}>
            Allow browser notifications for satellite events when this tab is in the background.
          </p>
          <button
            onClick={handleRequestPermission}
            className="w-full text-[10px] rounded py-1 cursor-pointer"
            style={{
              background: 'rgba(56,243,191,0.15)',
              color: '#38f3bf',
              border: '1px solid rgba(56,243,191,0.2)',
            }}
          >
            Enable Notifications
          </button>
        </div>
      )}

      {isGranted && (
        <div className="mt-3 space-y-3">
          <ToggleRow
            label="Re-entry alerts"
            enabled={notificationPrefs.reentryEnabled}
            onToggle={() => updatePref('reentryEnabled', !notificationPrefs.reentryEnabled)}
          />
          <ToggleRow
            label="Close approach alerts"
            enabled={notificationPrefs.closeApproachEnabled}
            onToggle={() => updatePref('closeApproachEnabled', !notificationPrefs.closeApproachEnabled)}
          />
          <ToggleRow
            label="Photobomb transit alerts"
            enabled={notificationPrefs.photobombEnabled}
            onToggle={() => updatePref('photobombEnabled', !notificationPrefs.photobombEnabled)}
          />

          {/* Lead time selector */}
          <div className="mt-3">
            <span className="text-[10px] block mb-2" style={{ color: 'var(--text-secondary)' }}>
              Alert lead time
            </span>
            <div className="flex gap-1">
              {LEAD_TIME_OPTIONS.map((min) => (
                <button
                  key={min}
                  onClick={() => updatePref('leadTimeMinutes', min)}
                  className="flex-1 text-[10px] py-1 rounded-full cursor-pointer transition-colors duration-200"
                  style={{
                    background:
                      notificationPrefs.leadTimeMinutes === min
                        ? 'var(--accent)'
                        : 'rgba(255,255,255,0.08)',
                    color:
                      notificationPrefs.leadTimeMinutes === min
                        ? '#0a0e17'
                        : 'var(--text-secondary)',
                    fontWeight: notificationPrefs.leadTimeMinutes === min ? 600 : 400,
                  }}
                >
                  {min}m
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
