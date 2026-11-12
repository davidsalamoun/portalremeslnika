import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, CheckCircle2 } from 'lucide-react';
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
      <div className="bg-emerald-600 text-white px-4 py-1.5 text-xs font-bold flex items-center justify-center gap-2 text-center animate-in slide-in-from-top duration-200 sticky top-0 z-50 shadow-md">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Jste opět online – připojení k síti bylo obnoveno</span>
      </div>
    );
  }

  return (
    <div className="bg-amber-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 text-center sticky top-0 z-50 shadow-md">
      <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
      <span>
        Režim bez signálu (offline): Vše se bezpečně ukládá v telefonu a synchronizuje se, jakmile vyjdete na signál.
      </span>
    </div>
  );
};
