import { useState, useEffect, useCallback } from 'react';
import { onToast } from '../../services/notificationService';

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    setToasts((prev) => [...prev, toast].slice(-3));

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 5000);
  }, []);

  useEffect(() => {
    const unsub = onToast(addToast);
    return unsub;
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="glass rounded-lg px-4 py-3 pointer-events-auto fade-in"
          style={{ borderLeft: '3px solid var(--accent)', maxWidth: 320 }}
        >
          <div
            className="text-xs font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            {toast.title}
          </div>
          <div
            className="text-[11px]"
            style={{ color: 'var(--text-primary)' }}
          >
            {toast.body}
          </div>
        </div>
      ))}
    </div>
  );
}
