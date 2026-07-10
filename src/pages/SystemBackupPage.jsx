import React, { useState } from 'react';
import useStore from '../store';
import { Download, Upload, CheckSquare, Square, AlertCircle, CheckCircle2 } from 'lucide-react';

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
        <p>Safely backup all your system data to a single JSON file, or restore data from a previous backup.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Backup Section */}
        <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>
            <Download size={24} />
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Create Backup</h2>
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
            <Download size={18} /> Download JSON Backup
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
