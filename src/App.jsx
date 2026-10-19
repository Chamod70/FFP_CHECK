import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, Database, Settings, CheckCircle2, X } from 'lucide-react';
import FFPPage from './pages/FFPPage';
import DataEntryPage from './pages/DataEntryPage';
import BackupPage from './pages/BackupPage';
import SystemBackupPage from './pages/SystemBackupPage';
import { checkAndRunAutoBackup } from './services/autoBackupService';
import './App.css';

function App() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    // Check immediately on load
    checkAndRunAutoBackup();

    // Check periodically every 30 seconds
    const interval = setInterval(() => {
      checkAndRunAutoBackup();
    }, 30000);

    // Listen for backup event
    const handleBackupCompleted = (e) => {
      const { fileName, savedDirectly, targetFolder, timestamp } = e.detail;
      setToast({
        title: 'Auto Backup Successful!',
        message: savedDirectly 
          ? `Saved to folder "${targetFolder || 'FFP BACKUP'}" as ${fileName} at ${timestamp}`
          : `Downloaded ${fileName} at ${timestamp}`,
        type: 'success'
      });
      setTimeout(() => {
        setToast(null);
      }, 7000);
    };

    window.addEventListener('ffp_backup_completed', handleBackupCompleted);

    return () => {
      clearInterval(interval);
      window.removeEventListener('ffp_backup_completed', handleBackupCompleted);
    };
  }, []);

  return (
    <Router>
      <div className="app-layout">
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #10b981',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '450px',
            animation: 'slideIn 0.3s ease-out'
          }}>
            <CheckCircle2 color="#10b981" size={24} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#10b981' }}>{toast.title}</div>
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', wordBreak: 'break-all' }}>{toast.message}</div>
            </div>
            <button 
              onClick={() => setToast(null)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>FFP System</h2>
            <p>v3.0 (With Excel Upload)</p>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/ffp" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={20} />
              <span>FFP Live Check</span>
            </NavLink>
            <NavLink to="/master-data" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Database size={20} />
              <span>Master Data Pages</span>
            </NavLink>
            <NavLink to="/backup" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Database size={20} />
              <span>Backup Data</span>
            </NavLink>
            <NavLink to="/system-backup" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Settings size={20} />
              <span>System Backup</span>
            </NavLink>
          </nav>
        </aside>
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/ffp" replace />} />
            <Route path="/ffp" element={<FFPPage />} />
            <Route path="/master-data" element={<DataEntryPage />} />
            <Route path="/backup" element={<BackupPage />} />
            <Route path="/system-backup" element={<SystemBackupPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
