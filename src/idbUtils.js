import { openDB } from 'idb';

const DB_NAME = 'teta-db';
const DB_VERSION = 1;

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('contacts')) {
        db.createObjectStore('contacts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        messageStore.createIndex('timestamp', 'timestamp');
        messageStore.createIndex('parent_id', 'parent_id');
      }
    },
  });
};

export const saveMessage = async (message) => {
  const db = await initDB();
  return db.put('messages', message);
};

export const getAllMessages = async () => {
  const db = await initDB();
  return db.getAllFromIndex('messages', 'timestamp');
};

export const clearMessages = async () => {
  const db = await initDB();
  return db.clear('messages');
};
