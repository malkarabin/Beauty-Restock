/*
 * db.js — שכבת נתונים (Data Layer)
 * ---------------------------------
 * כל הגישה לנתונים עוברת דרך האובייקט Store בלבד.
 * כרגע המימוש מקומי (IndexedDB). כשנרצה ענן בעתיד —
 * מספיק להחליף את המימוש כאן (או להוסיף adapter) בלי לגעת
 * בשאר האפליקציה, כי הממשק (getAll/get/put/remove) נשאר זהה.
 */
(function (global) {
  'use strict';

  const DB_NAME = 'beauty-restock';
  const DB_VERSION = 1;
  const STORE = 'products';

  let _dbPromise = null;

  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('updatedAt', 'updatedAt');
          os.createIndex('category', 'category');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return _dbPromise;
  }

  function tx(mode) {
    return openDB().then((db) => db.transaction(STORE, mode).objectStore(STORE));
  }

  function reqToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function uid() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  const Store = {
    /** כל המוצרים, ממויינים מהמעודכן ביותר */
    async getAll() {
      const os = await tx('readonly');
      const all = await reqToPromise(os.getAll());
      return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },

    async get(id) {
      const os = await tx('readonly');
      return reqToPromise(os.get(id));
    },

    /** יצירה/עדכון. מחזיר את הרשומה השמורה. */
    async put(product) {
      const now = Date.now();
      const record = Object.assign({}, product);
      if (!record.id) record.id = uid();
      if (!record.createdAt) record.createdAt = now;
      record.updatedAt = now;
      const os = await tx('readwrite');
      await reqToPromise(os.put(record));
      return record;
    },

    async remove(id) {
      const os = await tx('readwrite');
      await reqToPromise(os.delete(id));
    },

    async count() {
      const os = await tx('readonly');
      return reqToPromise(os.count());
    },

    /** ייצוא לגיבוי — תמונות מומרות ל-base64 כדי שיהיו בתוך הקובץ */
    async exportAll() {
      const items = await this.getAll();
      const out = [];
      for (const item of items) {
        const copy = Object.assign({}, item);
        if (item.photo instanceof Blob) {
          copy.photo = await blobToDataURL(item.photo);
        }
        out.push(copy);
      }
      return {
        app: 'beauty-restock',
        version: 1,
        exportedAt: new Date().toISOString(),
        products: out,
      };
    },

    /** שחזור מגיבוי. merge=true משאיר את הקיים ומוסיף, אחרת מחליף הכל. */
    async importAll(data, merge) {
      if (!data || !Array.isArray(data.products)) {
        throw new Error('קובץ הגיבוי אינו תקין');
      }
      if (!merge) {
        const os = await tx('readwrite');
        await reqToPromise(os.clear());
      }
      let imported = 0;
      for (const raw of data.products) {
        const record = Object.assign({}, raw);
        if (typeof record.photo === 'string' && record.photo.startsWith('data:')) {
          record.photo = dataURLToBlob(record.photo);
        }
        if (!record.id) record.id = uid();
        if (!record.createdAt) record.createdAt = Date.now();
        if (!record.updatedAt) record.updatedAt = Date.now();
        const os = await tx('readwrite');
        await reqToPromise(os.put(record));
        imported++;
      }
      return imported;
    },
  };

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  function dataURLToBlob(dataURL) {
    const [head, body] = dataURL.split(',');
    const mime = (head.match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const bin = atob(body);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  global.Store = Store;
  global._dbHelpers = { blobToDataURL, dataURLToBlob };
})(window);
