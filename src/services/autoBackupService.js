import idbStorage from '../idb-storage';
import useStore from '../store';

const STORAGE_KEY_CONFIG = 'ffp_auto_backup_config';
const IDB_HANDLE_KEY = 'ffp_backup_dir_handle';

export const getAutoBackupConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load auto backup config', e);
  }
  return {
    enabled: true,
    time: '16:00', // 4:00 PM
    lastBackupDate: null,
    lastBackupTimestamp: null,
    folderName: null
  };
};

export const saveAutoBackupConfig = (config) => {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save auto backup config', e);
  }
};

export const getStoredDirectoryHandle = async () => {
  try {
    const handle = await idbStorage.getItem(IDB_HANDLE_KEY);
    return handle || null;
  } catch (e) {
    console.error('Error fetching directory handle:', e);
    return null;
  }
};

export const setStoredDirectoryHandle = async (handle) => {
  try {
    if (handle) {
      await idbStorage.setItem(IDB_HANDLE_KEY, handle);
      const config = getAutoBackupConfig();
      config.folderName = handle.name || 'Selected Folder';
      saveAutoBackupConfig(config);
    } else {
      await idbStorage.removeItem(IDB_HANDLE_KEY);
      const config = getAutoBackupConfig();
      config.folderName = null;
      saveAutoBackupConfig(config);
    }
  } catch (e) {
    console.error('Error storing directory handle:', e);
  }
};

// Check permission or request permission if needed
export const verifyPermission = async (fileHandle, readWrite = true) => {
  const options = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
};

// Select folder via File System Access API
export const selectBackupFolder = async () => {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('Your browser does not support folder selection. Backup will be downloaded automatically.');
  }
  const handle = await window.showDirectoryPicker({
    id: 'ffp_backup_picker',
    mode: 'readwrite',
    startIn: 'desktop'
  });
  await setStoredDirectoryHandle(handle);
  return handle;
};

// Perform backup creation
export const performBackup = async (source = 'auto') => {
  const state = useStore.getState();
  const dateObj = new Date();
  const dateStr = dateObj.toISOString().split('T')[0];
  const timeStr = dateObj.toTimeString().split(' ')[0].replace(/:/g, '-');
  const fileName = `ffp_system_backup_${dateStr}_${timeStr}.json`;

  const backupObject = {
    timestamp: dateObj.toISOString(),
    version: '3.0',
    source: source,
    ffpManualData: state.ffpManualData,
    masterData: state.masterData,
    backupData: state.backupData,
    columnWidths: state.columnWidths,
    customHeaders: state.customHeaders,
    columnAlignments: state.columnAlignments,
    columnVerticalAlignments: state.columnVerticalAlignments,
    hiddenColumns: state.hiddenColumns,
    hiddenColumnGroup: state.hiddenColumnGroup
  };

  const jsonString = JSON.stringify(backupObject, null, 2);

  // Try writing to directory handle if available
  let savedDirectly = false;
  let targetFolder = null;
  const dirHandle = await getStoredDirectoryHandle();

  if (dirHandle) {
    try {
      const hasPermission = await verifyPermission(dirHandle, true);
      if (hasPermission) {
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        savedDirectly = true;
        targetFolder = dirHandle.name;
      }
    } catch (err) {
      console.warn('Could not write directly to folder handle, falling back to download:', err);
    }
  }

  // Fallback to browser download if directory handle is not set or failed
  if (!savedDirectly) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Update last backup config
  const config = getAutoBackupConfig();
  config.lastBackupDate = dateStr;
  config.lastBackupTimestamp = dateObj.toISOString();
  saveAutoBackupConfig(config);

  // Dispatch event for UI notifications
  window.dispatchEvent(new CustomEvent('ffp_backup_completed', {
    detail: {
      fileName,
      savedDirectly,
      targetFolder,
      timestamp: dateObj.toLocaleTimeString(),
      source
    }
  }));

  return {
    success: true,
    fileName,
    savedDirectly,
    targetFolder
  };
};

// Scheduler function to check time and trigger auto backup
export const checkAndRunAutoBackup = async () => {
  const config = getAutoBackupConfig();
  if (!config.enabled) return;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Already backed up today
  if (config.lastBackupDate === todayStr) {
    return;
  }

  // Parse target time (default 16:00 = 4:00 PM)
  const [targetHour, targetMinute] = (config.time || '16:00').split(':').map(Number);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Check if current time is at or after scheduled time
  if (currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute)) {
    console.log(`[FFP Auto Backup] Triggering daily backup for ${todayStr} at ${now.toLocaleTimeString()}`);
    try {
      await performBackup('scheduled_4pm');
    } catch (err) {
      console.error('[FFP Auto Backup] Error executing scheduled backup:', err);
    }
  }
};
