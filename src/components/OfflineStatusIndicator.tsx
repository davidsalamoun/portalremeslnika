import React, { useState, useEffect } from 'react';
import { WifiOff, CheckCircle2 } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

export const OfflineStatusIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      triggerHaptic('success');
      setTimeout(() => setShowReconnected(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      triggerHaptic('warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) {
    return null;
  }

  if (showReconnected) {
    return (
      <div role="status" className="bg-emerald-700 text-white px-4 py-2 text-[14px] font-medium flex items-center justify-center gap-2 text-center sticky top-0 z-50">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>Signál je zpět, změny se odesílají do účtu.</span>
      </div>
    );
  }

  return (
    <div role="status" className="bg-slate-900 dark:bg-slate-800 text-white px-4 py-2 text-[14px] font-medium flex items-center justify-center gap-2 text-center sticky top-0 z-50">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Jste bez signálu. Změny se ukládají v zařízení a odešlou se, až bude signál.</span>
    </div>
  );
};
