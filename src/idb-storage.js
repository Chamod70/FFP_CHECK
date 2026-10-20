const DB_NAME = 'ffp-database';
const STORE_NAME = 'ffp-store';

let dbInstance = null;
let dbPromise = null;

const getDB = () => {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
        dbPromise = null;
      };
      resolve(dbInstance);
    };
    request.onerror = () => {
      dbPromise = null;
      resolve(null);
    };
  });
  return dbPromise;
};

const idbStorage = {
  getItem: async (name) => {
    const db = await getDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(name);
        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  },
  setItem: async (name, value) => {
    const db = await getDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(value, name);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      } catch (err) {
        resolve();
      }
    });
  },
  removeItem: async (name) => {
    const db = await getDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(name);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      } catch (err) {
        resolve();
      }
    });
  }
};

export default idbStorage;

