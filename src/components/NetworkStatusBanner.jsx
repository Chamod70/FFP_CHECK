import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, ShieldCheck, Download, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { performBackup } from '../services/autoBackupService';
import { flushStorage, saveOfflineEmergencySnapshot } from '../store';

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showReconnectedAlert, setShowReconnectedAlert] = useState(false);
  const [lastSaved, setLastSaved] = useState(() => new Date().toLocaleTimeString());
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedAlert(true);
      // Auto-hide reconnected toast after 6s
      setTimeout(() => setShowReconnectedAlert(false), 6000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnectedAlert(false);
      // Guarantee immediate storage save and emergency snapshot
      flushStorage();
      saveOfflineEmergencySnapshot('network_offline_detected');
    };

    const handleStorageSaved = (e) => {
      if (e.detail?.timestamp) {
        setLastSaved(e.detail.timestamp);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('ffp_storage_saved', handleStorageSaved);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('ffp_storage_saved', handleStorageSaved);
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
          background: 'linear-gradient(90deg, #b91c1c 0%, #991b1b 100%)',
          color: '#fff',
          padding: '0.65rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
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
                <span>Network Disconnected (Offline Mode)</span>
                <span style={{
                  background: '#fef08a',
                  color: '#854d0e',
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 700
                }}>
                  Data Safe
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#fee2e2' }}>
                You can continue typing safely. All entered data is automatically preserved in your local browser database.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
              Last saved locally: {lastSaved}
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
              {isDownloading ? 'Exporting...' : 'Save File Backup'}
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
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Network Connection Restored!</div>
              <div style={{ fontSize: '0.8rem', color: '#d1fae5' }}>
                You are back online. All data entered while offline is completely safe and intact.
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
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSaved, setLastSaved] = useState(() => new Date().toLocaleTimeString());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleStorageSaved = (e) => {
      if (e.detail?.timestamp) setLastSaved(e.detail.timestamp);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('ffp_storage_saved', handleStorageSaved);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
