import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, ShieldCheck, Download, X, CheckCircle2, Lock, ToggleLeft, ToggleRight } from 'lucide-react';
import { performBackup } from '../services/autoBackupService';
import { flushStorage, saveOfflineEmergencySnapshot } from '../store';

/**
 * Checks if the connection is Ethernet (LAN)
 */
export function isEthernetConnection() {
  if (typeof navigator === 'undefined') return false;
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    if (conn.type === 'ethernet' || conn.type === 'wired') {
      return true;
    }
  }
  return false;
}

/**
 * Checks user forced mode or auto Ethernet detection
 */
export function getSavedNetworkMode() {
  try {
    const saved = localStorage.getItem('ffp_network_mode');
    if (saved === 'offline') return false;
    if (saved === 'online') return true;
  } catch (e) {}
  // Default: If Ethernet connection is detected, consider it OFFLINE as requested!
  if (isEthernetConnection()) {
    return false;
  }
  return null; // Auto probe
}

/**
 * Universal Connectivity Test
 * Probes real WAN access using fast Image ping.
 */
export async function testRealConnectivity() {
  // If user explicitly saved mode or Ethernet detected
  const mode = getSavedNetworkMode();
  if (mode === false) {
    return false; // Treat Ethernet / forced offline as offline!
  }

  // If the browser itself knows it is offline, believe it immediately
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  // Probe external favicon using Image load with a fast timeout (800ms)
  const probePromise = new Promise((resolve) => {
    let resolved = false;
    const finish = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    const timer = setTimeout(() => finish(false), 800);

    const img1 = new Image();
    img1.onload = () => {
      clearTimeout(timer);
      finish(true);
    };
    img1.onerror = () => {
      clearTimeout(timer);
      finish(false);
    };

    img1.src = 'https://www.google.com/favicon.ico?_p=' + Date.now();
  });

  return probePromise;
}

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(() => {
    const saved = getSavedNetworkMode();
    return saved !== null ? saved : false; // Default to false (Offline) if Ethernet
  });
  const [showReconnectedAlert, setShowReconnectedAlert] = useState(false);
  const [lastSaved, setLastSaved] = useState(() => new Date().toLocaleTimeString());
  const [isDownloading, setIsDownloading] = useState(false);
  const effectiveOnlineRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const evaluateAndSync = async () => {
      if (!isMounted) return;
      const detected = await testRealConnectivity();
      
      const prev = effectiveOnlineRef.current;
      effectiveOnlineRef.current = detected;
      setIsOnline(detected);

      if (typeof window !== 'undefined') {
        window.__FFP_IS_OFFLINE = !detected;
        window.dispatchEvent(new CustomEvent('ffp_network_change', { 
          detail: { isOnline: detected } 
        }));
      }

      if (prev !== detected) {
        if (!detected) {
          console.warn('[FFP Network] Entered Offline mode (Ethernet / No Internet). Data protection active.');
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

    evaluateAndSync();
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
        e.returnValue = 'You are in Offline Mode (Ethernet). Refreshing is disabled to protect your entered data.';
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
  }, []);

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
                <span>Offline Mode (Ethernet / No Internet)</span>
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
  const [isOnline, setIsOnline] = useState(() => {
    const saved = getSavedNetworkMode();
    return saved !== null ? saved : false;
  });
  const [lastSaved, setLastSaved] = useState(() => new Date().toLocaleTimeString());

  const toggleNetworkMode = () => {
    const nextMode = !isOnline;
    setIsOnline(nextMode);
    try {
      localStorage.setItem('ffp_network_mode', nextMode ? 'online' : 'offline');
    } catch (e) {}
    if (typeof window !== 'undefined') {
      window.__FFP_IS_OFFLINE = !nextMode;
      window.dispatchEvent(new CustomEvent('ffp_network_change', { detail: { isOnline: nextMode } }));
    }
  };

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
      background: 'rgba(0,0,0,0.25)',
      fontSize: '0.78rem'
    }}>
      <div 
        onClick={toggleNetworkMode}
        title="Click to toggle between Online and Offline Mode"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '4px 6px',
          borderRadius: '6px',
          background: isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.4)'}`,
          marginBottom: '6px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isOnline ? '#10b981' : '#ef4444',
            display: 'inline-block',
            boxShadow: isOnline ? '0 0 8px #10b981' : '0 0 8px #ef4444'
          }} />
          <span style={{ fontWeight: 600, color: isOnline ? '#34d399' : '#f87171', fontSize: '0.8rem' }}>
            {isOnline ? 'Online' : 'Offline Mode'}
          </span>
        </div>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          Toggle
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
