import React, { useState, useEffect } from 'react';
import useStore from '../store';
import { Download, Upload, CheckSquare, Square, AlertCircle, CheckCircle2, Clock, Folder, FolderCheck, Play, RefreshCw } from 'lucide-react';
import { 
  getAutoBackupConfig, 
  saveAutoBackupConfig, 
  getStoredDirectoryHandle, 
  selectBackupFolder, 
  performBackup 
} from '../services/autoBackupService';

function SystemBackupPage() {
  const { masterData, ffpManualData, backupData, setAllMasterData, setFfpData, setBackupData } = useStore();
  
  const [selectedForBackup, setSelectedForBackup] = useState({
    ffpData: true,
    masterData: true,
    backupData: true
  });

  const [selectedForRestore, setSelectedForRestore] = useState({
    ffpData: true,
    masterData: true,
    backupData: true
  });

  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreStatus, setRestoreStatus] = useState(null); // { type: 'success' | 'error', message: '' }

  // Auto Backup State
  const [autoConfig, setAutoConfig] = useState(getAutoBackupConfig());
  const [hasFolderHandle, setHasFolderHandle] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [autoStatusMessage, setAutoStatusMessage] = useState(null);
  const [isTestingBackup, setIsTestingBackup] = useState(false);

  useEffect(() => {
    checkFolderStatus();
  }, []);

  const checkFolderStatus = async () => {
    const handle = await getStoredDirectoryHandle();
    if (handle) {
      setHasFolderHandle(true);
      setFolderName(handle.name || 'FFP BACKUP');
    } else {
      setHasFolderHandle(false);
      setFolderName('');
    }
    setAutoConfig(getAutoBackupConfig());
  };

  const handleToggleAutoBackup = () => {
    const updated = { ...autoConfig, enabled: !autoConfig.enabled };
    setAutoConfig(updated);
    saveAutoBackupConfig(updated);
  };

  const handleTimeChange = (e) => {
    const updated = { ...autoConfig, time: e.target.value };
    setAutoConfig(updated);
    saveAutoBackupConfig(updated);
  };

  const handleSelectFolder = async () => {
    try {
      const handle = await selectBackupFolder();
      setHasFolderHandle(true);
      setFolderName(handle.name || 'FFP BACKUP');
      setAutoStatusMessage({
        type: 'success',
        message: `Successfully linked folder: "${handle.name}". Backups at 4:00 PM will now save directly inside this folder!`
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setAutoStatusMessage({
          type: 'error',
          message: err.message || 'Could not select folder.'
        });
      }
    }
  };

  const handleRunManualAutoBackup = async () => {
    setIsTestingBackup(true);
    setAutoStatusMessage(null);
    try {
      const res = await performBackup('manual_test');
      setAutoStatusMessage({
        type: 'success',
        message: res.savedDirectly 
          ? `Backup created successfully inside folder "${res.targetFolder || 'FFP BACKUP'}" as ${res.fileName}!`
          : `Backup downloaded successfully as ${res.fileName}!`
      });
      checkFolderStatus();
    } catch (err) {
      setAutoStatusMessage({
        type: 'error',
        message: `Backup failed: ${err.message}`
      });
    } finally {
      setIsTestingBackup(false);
    }
  };

  const handleBackupToggle = (key) => {
    setSelectedForBackup(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRestoreToggle = (key) => {
    setSelectedForRestore(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDownloadBackup = () => {
    const backupObject = {
      timestamp: new Date().toISOString(),
      version: '3.0'
    };

    if (selectedForBackup.ffpData) backupObject.ffpManualData = ffpManualData;
    if (selectedForBackup.masterData) backupObject.masterData = masterData;
    if (selectedForBackup.backupData) backupObject.backupData = backupData;

    const jsonString = JSON.stringify(backupObject, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Format date for filename
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `ffp_system_backup_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRestoreFile(file);
      setRestoreStatus(null);
    }
  };

  const handleRestoreBackup = () => {
    if (!restoreFile) {
      setRestoreStatus({ type: 'error', message: 'Please select a backup JSON file first.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        let restoredCount = 0;

        if (selectedForRestore.ffpData && data.ffpManualData) {
          setFfpData(data.ffpManualData);
          restoredCount++;
        }
        if (selectedForRestore.masterData && data.masterData) {
          setAllMasterData(data.masterData);
          restoredCount++;
        }
        if (selectedForRestore.backupData && data.backupData) {
          setBackupData(data.backupData);
          restoredCount++;
        }

        if (restoredCount > 0) {
          setRestoreStatus({ type: 'success', message: `Successfully restored ${restoredCount} section(s)!` });
        } else {
          setRestoreStatus({ type: 'error', message: 'No sections were selected or found in the backup file.' });
        }
      } catch (err) {
        setRestoreStatus({ type: 'error', message: 'Invalid backup file format. Please upload a valid JSON backup.' });
      }
    };
    reader.onerror = () => {
      setRestoreStatus({ type: 'error', message: 'Error reading the file.' });
    };
    reader.readAsText(restoreFile);
  };

  return (
    <div className="page-container" style={{maxWidth: '100%', padding: '2rem'}}>
      <div className="header" style={{ marginBottom: '2rem' }}>
        <h1 style={{marginTop: 0}}>System Backup & Restore</h1>
        <p>Safely backup all your system data to a single JSON file, schedule daily automatic backups at 4:00 PM, or restore previous data.</p>
      </div>

      {/* Daily Automatic Backup Card */}
      <div className="card" style={{ 
        padding: '2rem', 
        marginBottom: '2rem', 
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#60a5fa' }}>
            <Clock size={28} />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#f8fafc' }}>Daily Auto-Backup Schedule (හැමදාම සවස 4.00ට ස්වයංක්‍රීය බැකප්)</h2>
              <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.95rem' }}>
                Automatically generates and saves your full system backup every day at 4:00 PM into your desktop folder.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
              <input 
                type="checkbox" 
                checked={autoConfig.enabled} 
                onChange={handleToggleAutoBackup} 
                style={{ width: '20px', height: '20px', accentColor: '#3b82f6' }} 
              />
              <span style={{ fontWeight: 600, color: autoConfig.enabled ? '#34d399' : '#94a3b8' }}>
                {autoConfig.enabled ? 'Auto Backup Active' : 'Auto Backup Disabled'}
              </span>
            </label>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px' }}>
          
          {/* Target Folder Setup */}
          <div>
            <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 600 }}>
              DESKTOP TARGET FOLDER
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <button 
                className="btn" 
                onClick={handleSelectFolder}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  background: hasFolderHandle ? '#059669' : '#2563eb', 
                  color: '#fff',
                  border: 'none',
                  padding: '0.6rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                {hasFolderHandle ? <FolderCheck size={18} /> : <Folder size={18} />}
                {hasFolderHandle ? `Linked: ${folderName}` : 'Select "FFP BACKUP" Folder'}
              </button>
            </div>
            <div style={{ fontSize: '0.85rem', color: hasFolderHandle ? '#34d399' : '#fbbf24' }}>
              {hasFolderHandle 
                ? `✅ Linked to: C:\\Users\\Chamod.Champika\\Desktop\\${folderName} (Direct Silent Save)`
                : '⚠️ Folder not linked yet. Click above to pick "Desktop\\FFP BACKUP" so backups save directly.'}
            </div>
          </div>

          {/* Time Setup */}
          <div>
            <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 600 }}>
              BACKUP TIME
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input 
                type="time" 
                value={autoConfig.time || '16:00'} 
                onChange={handleTimeChange}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  padding: '0.55rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '1.1rem',
                  fontWeight: 600
                }}
              />
              <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>(Default: 04:00 PM)</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
              Next auto-backup: <span style={{ color: '#60a5fa', fontWeight: 600 }}>Today at {autoConfig.time || '16:00'}</span>
            </div>
          </div>

          {/* Last Backup Info & Immediate Test */}
          <div>
            <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 600 }}>
              STATUS & TEST RUN
            </div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>
              Last Backup: <span style={{ color: autoConfig.lastBackupTimestamp ? '#34d399' : '#94a3b8' }}>
                {autoConfig.lastBackupTimestamp 
                  ? new Date(autoConfig.lastBackupTimestamp).toLocaleString() 
                  : 'No backup recorded yet'}
              </span>
            </div>
            <button 
              className="btn" 
              onClick={handleRunManualAutoBackup}
              disabled={isTestingBackup}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#475569',
                color: '#fff',
                border: 'none',
                padding: '0.6rem 1rem',
                borderRadius: '6px',
                cursor: isTestingBackup ? 'not-allowed' : 'pointer',
                fontWeight: 500
              }}
            >
              {isTestingBackup ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
              {isTestingBackup ? 'Saving Backup...' : 'Run Backup Now (Test)'}
            </button>
          </div>

        </div>

        {autoStatusMessage && (
          <div style={{
            marginTop: '1rem',
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            background: autoStatusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${autoStatusMessage.type === 'error' ? 'var(--danger)' : 'var(--success)'}`,
            color: autoStatusMessage.type === 'error' ? '#f87171' : '#34d399',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            {autoStatusMessage.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            <span>{autoStatusMessage.message}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Backup Section */}
        <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>
            <Download size={24} />
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Manual Backup Export</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Select the data you want to include in the backup file:</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedForBackup.ffpData} onChange={() => handleBackupToggle('ffpData')} style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: '1.1rem' }}>FFP Live Check Data</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedForBackup.masterData} onChange={() => handleBackupToggle('masterData')} style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: '1.1rem' }}>Master Data (All Sheets)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedForBackup.backupData} onChange={() => handleBackupToggle('backupData')} style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: '1.1rem' }}>Cleared Backup Data</span>
            </label>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={handleDownloadBackup}
            disabled={!selectedForBackup.ffpData && !selectedForBackup.masterData && !selectedForBackup.backupData}
            style={{ alignSelf: 'flex-start', marginTop: 'auto' }}
          >
            <Download size={18} /> Download JSON Backup Now
          </button>
        </div>

        {/* Restore Section */}
        <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
            <Upload size={24} />
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Restore Data</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Select a backup file and choose which data to restore:</p>
          
          <input 
            type="file" 
            accept=".json" 
            onChange={handleFileChange} 
            className="cell-input"
            style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'rgba(0,0,0,0.2)' }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedForRestore.ffpData} onChange={() => handleRestoreToggle('ffpData')} style={{ width: '18px', height: '18px', accentColor: 'var(--success)' }} />
              <span style={{ fontSize: '1.1rem' }}>Restore FFP Live Check Data</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedForRestore.masterData} onChange={() => handleRestoreToggle('masterData')} style={{ width: '18px', height: '18px', accentColor: 'var(--success)' }} />
              <span style={{ fontSize: '1.1rem' }}>Restore Master Data</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedForRestore.backupData} onChange={() => handleRestoreToggle('backupData')} style={{ width: '18px', height: '18px', accentColor: 'var(--success)' }} />
              <span style={{ fontSize: '1.1rem' }}>Restore Cleared Backup Data</span>
            </label>
          </div>

          {restoreStatus && (
            <div style={{
              padding: '1rem', 
              borderRadius: '0.5rem', 
              background: restoreStatus.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              border: `1px solid ${restoreStatus.type === 'error' ? 'var(--danger)' : 'var(--success)'}`,
              color: restoreStatus.type === 'error' ? 'var(--danger)' : 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {restoreStatus.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
              {restoreStatus.message}
            </div>
          )}

          <button 
            className="btn btn-success" 
            onClick={handleRestoreBackup}
            disabled={(!selectedForRestore.ffpData && !selectedForRestore.masterData && !selectedForRestore.backupData) || !restoreFile}
            style={{ alignSelf: 'flex-start', marginTop: 'auto' }}
          >
            <Upload size={18} /> Restore Selected Data
          </button>
        </div>

      </div>
    </div>
  );
}

export default SystemBackupPage;

