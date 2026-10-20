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
    lastScheduledKey: null, // e.g. "2026-10-19_16:00"
    lastBackupTimestamp: null,
    lastBackupSource: null,
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

export const resetScheduledBackupToday = () => {
  const config = getAutoBackupConfig();
  config.lastScheduledKey = null;
  saveAutoBackupConfig(config);
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

// Check permission without throwing in automated background tasks
export const verifyPermission = async (fileHandle, isUserGesture = false) => {
  if (!fileHandle) return false;
  const options = { mode: 'readwrite' };
  try {
    const status = await fileHandle.queryPermission(options);
    if (status === 'granted') {
      return true;
    }
    // Only prompt for permission if we have a direct user interaction (click)
    if (isUserGesture && status === 'prompt') {
      const requestStatus = await fileHandle.requestPermission(options);
      return requestStatus === 'granted';
    }
  } catch (err) {
    console.warn('[FFP Backup] verifyPermission:', err);
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
  
  // Explicitly request readwrite permission while we have the user gesture
  await verifyPermission(handle, true);
  await setStoredDirectoryHandle(handle);
  return handle;
};

// Perform backup creation
export const performBackup = async (source = 'manual_test', isUserGesture = true) => {
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
    hiddenColumnGroup: state.hiddenColumnGroup,
    showHideGroupBar: state.showHideGroupBar !== undefined ? state.showHideGroupBar : true
  };

  const jsonString = JSON.stringify(backupObject, null, 2);

  // Try writing to directory handle if available
  let savedDirectly = false;
  let targetFolder = null;
  const dirHandle = await getStoredDirectoryHandle();

  if (dirHandle) {
    try {
      const hasPermission = await verifyPermission(dirHandle, isUserGesture);
      if (hasPermission) {
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        savedDirectly = true;
        targetFolder = dirHandle.name;
        console.log(`[FFP Backup] Successfully saved directly to ${targetFolder}/${fileName}`);
      } else {
        console.warn('[FFP Backup] Folder permission not granted, falling back to download');
      }
    } catch (err) {
      console.warn('[FFP Backup] Could not write directly to folder handle, falling back to download:', err);
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
    console.log(`[FFP Backup] Triggered browser download: ${fileName}`);
  }

  // Update backup timestamp in config
  const config = getAutoBackupConfig();
  config.lastBackupTimestamp = dateObj.toISOString();
  config.lastBackupSource = source;
  // If this was a scheduled backup, mark its key
  if (source === 'scheduled') {
    config.lastScheduledKey = `${dateStr}_${config.time || '16:00'}`;
  }
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
  const targetTime = config.time || '16:00';
  const scheduledKey = `${todayStr}_${targetTime}`;

  // Check if this specific scheduled time was already run today
  if (config.lastScheduledKey === scheduledKey) {
    return;
  }

  // Parse target time (e.g. 16:00)
  const [targetHour, targetMinute] = targetTime.split(':').map(Number);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Check if current time has reached or passed the scheduled time
  const isTimeReached = currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute);

  if (isTimeReached) {
    console.log(`[FFP Auto Backup] Triggering scheduled backup for ${scheduledKey} at ${now.toLocaleTimeString()}`);
    
    // Prevent double firing immediately
    config.lastScheduledKey = scheduledKey;
    saveAutoBackupConfig(config);

    try {
      await performBackup('scheduled', false);
    } catch (err) {
      console.error('[FFP Auto Backup] Error executing scheduled backup:', err);
    }
  }
};
