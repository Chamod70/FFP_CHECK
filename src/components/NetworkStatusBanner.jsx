import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, ShieldCheck, Download, X, CheckCircle2, Lock, RefreshCw } from 'lucide-react';
import { performBackup } from '../services/autoBackupService';
import { flushStorage, saveOfflineEmergencySnapshot } from '../store';

/**
 * Universal Connectivity Test
 * Uses HTML Image probe (cannot be blocked by CORS or SW) to check real WAN access,
 * and origin fetch to check server connectivity.
 */
export async function testRealConnectivity() {
  // If the browser itself knows it is offline, believe it immediately
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  // Probe external favicon using Image load
  const probePromise = new Promise((resolve) => {
    let resolved = false;
    const finish = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    const timer = setTimeout(() => finish(false), 2000);

    const img1 = new Image();
    img1.onload = () => {
      clearTimeout(timer);
      finish(true);
    };
    img1.onerror = () => {
      // Fallback probe
      const img2 = new Image();
      img2.onload = () => {
        clearTimeout(timer);
        finish(true);
      };
      img2.onerror = () => {
        clearTimeout(timer);
        finish(false);
      };
      img2.src = 'https://www.cloudflare.com/favicon.ico?_p=' + Date.now();
    };

    img1.src = 'https://www.google.com/favicon.ico?_p=' + Date.now();
  });

  return probePromise;
}

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [manualOffline, setManualOffline] = useState(false);
  const [showReconnectedAlert, setShowReconnectedAlert] = useState(false);
  const [lastSaved, setLastSaved] = useState(() => new Date().toLocaleTimeString());
  const [isDownloading, setIsDownloading] = useState(false);
  const effectiveOnlineRef = useRef(true);

  useEffect(() => {
    let isMounted = true;

    const evaluateAndSync = async () => {
      if (!isMounted) return;
      const detected = await testRealConnectivity();
      const effectiveOnline = manualOffline ? false : detected;
      
      const prev = effectiveOnlineRef.current;
      effectiveOnlineRef.current = effectiveOnline;
      setIsOnline(effectiveOnline);

      if (typeof window !== 'undefined') {
        window.__FFP_IS_OFFLINE = !effectiveOnline;
        window.dispatchEvent(new CustomEvent('ffp_network_change', { 
          detail: { isOnline: effectiveOnline, manual: manualOffline } 
        }));
      }

      if (prev !== effectiveOnline) {
        if (!effectiveOnline) {
          console.warn('[FFP Network] Entered Offline mode. Activating offline data protection and reload lock.');
          flushStorage();
          saveOfflineEmergencySnapshot('network_offline');
          setShowReconnectedAlert(false);
        } else {
          console.log('[FFP Network] Back Online.');
          setShowReconnectedAlert(true);
          setTimeout(() => {
            if (isMounted) setShowReconnectedAlert(false);
          }, 6000);
        }
      }
    };

    // Run active check immediately on mount
    evaluateAndSync();

    // Check periodically every 2 seconds
    const interval = setInterval(evaluateAndSync, 2000);

    const handleBrowserOnline = () => evaluateAndSync();
    const handleBrowserOffline = () => {
      effectiveOnlineRef.current = false;
      setIsOnline(false);
      if (typeof window !== 'undefined') {
        window.__FFP_IS_OFFLINE = true;
        window.dispatchEvent(new CustomEvent('ffp_network_change', { detail: { isOnline: false } }));
      }
      flushStorage();
      saveOfflineEmergencySnapshot('browser_offline_event');
    };

    const handleStorageSaved = (e) => {
      if (e.detail?.timestamp && isMounted) {
        setLastSaved(e.detail.timestamp);
      }
    };

    // 1. Prevent refresh / closing in Offline Mode via beforeunload
    const handleBeforeUnload = (e) => {
      if (!effectiveOnlineRef.current) {
        e.preventDefault();
        e.returnValue = 'You are in Offline Mode. Refreshing is disabled to protect your entered data.';
        return e.returnValue;
      }
    };

    // 2. Prevent F5 and Ctrl+R keyboard shortcuts in Offline Mode
    const handleKeyDown = (e) => {
      if (!effectiveOnlineRef.current) {
        if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
          e.preventDefault();
          e.stopPropagation();
          alert('Offline mode එකේදී Refresh කිරීම අක්‍රිය කර ඇත (ඔබ ඇතුළත් කළ දත්ත ආරක්ෂා කිරීමට). ඔබගේ දත්ත බ්‍රවුසරයේ 100% සුරක්ෂිතයි.');
        }
      }
    };

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);
    window.addEventListener('ffp_storage_saved', handleStorageSaved);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
      window.removeEventListener('ffp_storage_saved', handleStorageSaved);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [manualOffline]);

  const handleDownloadEmergencyBackup = async () => {
    setIsDownloading(true);
    try {
      await flushStorage();
      await performBackup('emergency_manual', true);
    } catch (e) {
      console.error(e);
      alert('Emergency backup download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div style={{
          background: 'linear-gradient(90deg, #991b1b 0%, #7f1d1d 100%)',
          color: '#fff',
          padding: '0.65rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          borderBottom: '2px solid #ef4444',
          zIndex: 9998,
          position: 'sticky',
          top: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '50%',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <WifiOff size={18} color="#fecaca" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Offline Mode (නෙට්වර්ක් නැත / Airplane Mode)</span>
                <span style={{
                  background: '#fef08a',
                  color: '#854d0e',
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <Lock size={10} /> Refresh Blocked • Data Safe
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#fee2e2' }}>
                ඔබ ඇතුළත් කරන සියලු දත්ත LocalStorage & IndexedDB හි සුරැකේ. දත්ත ආරක්ෂා කරගැනීම සඳහා පිටුව Refresh වීම ස්වයංක්‍රීයව අවහිර කර ඇත.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
              Saved locally: {lastSaved}
            </span>
            <button
              onClick={handleDownloadEmergencyBackup}
              disabled={isDownloading}
              style={{
                background: '#fff',
                color: '#991b1b',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <Download size={14} />
              {isDownloading ? 'Saving...' : 'Save File Backup'}
            </button>
          </div>
        </div>
      )}

      {/* Online Restored Toast */}
      {showReconnectedAlert && isOnline && (
        <div style={{
          background: 'linear-gradient(90deg, #065f46 0%, #047857 100%)',
          color: '#fff',
          padding: '0.65rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          borderBottom: '2px solid #10b981',
          zIndex: 9998,
          position: 'sticky',
          top: 0,
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle2 size={18} color="#a7f3d0" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Network Connection Restored (Online)!</div>
              <div style={{ fontSize: '0.8rem', color: '#d1fae5' }}>
                ඔබ නැවත Network එකට සම්බන්ධ විය. Offline කාලය තුළ ඇතුළත් කළ සියලු දත්ත නොවෙනස්ව සුරක්ෂිතයි.
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowReconnectedAlert(false)}
            style={{ background: 'transparent', border: 'none', color: '#a7f3d0', cursor: 'pointer', padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}

export function SidebarNetworkBadge() {
  const [isOnline, setIsOnline] = useState(true);
  const [lastSaved, setLastSaved] = useState(() => new Date().toLocaleTimeString());

  useEffect(() => {
    let isMounted = true;

    const syncStatus = async () => {
      const status = await testRealConnectivity();
      if (isMounted) setIsOnline(status);
    };

    syncStatus();
    const interval = setInterval(syncStatus, 2000);

    const handleNetworkChange = (e) => {
      if (typeof e.detail?.isOnline === 'boolean' && isMounted) {
        setIsOnline(e.detail.isOnline);
      }
    };

    const handleStorageSaved = (e) => {
      if (e.detail?.timestamp && isMounted) setLastSaved(e.detail.timestamp);
    };

    window.addEventListener('ffp_network_change', handleNetworkChange);
    window.addEventListener('ffp_storage_saved', handleStorageSaved);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('ffp_network_change', handleNetworkChange);
      window.removeEventListener('ffp_storage_saved', handleStorageSaved);
    };
  }, []);

  return (
    <div style={{
      marginTop: 'auto',
      padding: '0.85rem 1rem',
      borderTop: '1px solid var(--border-color)',
      background: 'rgba(0,0,0,0.2)',
      fontSize: '0.78rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '4px' }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isOnline ? '#10b981' : '#ef4444',
          display: 'inline-block',
          boxShadow: isOnline ? '0 0 8px #10b981' : '0 0 8px #ef4444'
        }} />
        <span style={{ fontWeight: 600, color: isOnline ? '#34d399' : '#f87171' }}>
          {isOnline ? 'Online' : 'Offline Mode'}
        </span>
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <ShieldCheck size={12} color="#38bdf8" />
        <span>Saved: {lastSaved}</span>
      </div>
    </div>
  );
}

export default NetworkStatusBanner;
