import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type RoomProfile,
} from "./types.ts";

const DATABASE_NAME = "room-eq-assistant";
const DATABASE_VERSION = 1;
const ROOMS_STORE = "rooms";
const SETTINGS_STORE = "settings";

export const serialiseRoom = (room: RoomProfile): string => JSON.stringify(room);

export const deserialiseRoom = (value: string): RoomProfile => {
  const parsed = JSON.parse(value) as RoomProfile;
  if (
    !parsed ||
    typeof parsed.id !== "string" ||
    typeof parsed.name !== "string" ||
    !Array.isArray(parsed.measurements)
  ) {
    throw new Error("Saved room data is invalid.");
  }
  return parsed;
};

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ROOMS_STORE)) {
        database.createObjectStore(ROOMS_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open local storage."));
  });

const runRequest = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Local storage operation failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Local storage transaction failed."));
    };
  });
};

export const getRooms = (): Promise<RoomProfile[]> =>
  runRequest<RoomProfile[]>(ROOMS_STORE, "readonly", (store) => store.getAll());

export const getRoom = (id: string): Promise<RoomProfile | undefined> =>
  runRequest<RoomProfile | undefined>(ROOMS_STORE, "readonly", (store) =>
    store.get(id),
  );

export const saveRoom = (room: RoomProfile): Promise<IDBValidKey> =>
  runRequest<IDBValidKey>(ROOMS_STORE, "readwrite", (store) => store.put(room));

export const deleteRoom = (id: string): Promise<undefined> =>
  runRequest<undefined>(ROOMS_STORE, "readwrite", (store) => store.delete(id));

export const getSettings = async (): Promise<AppSettings> => {
  const result = await runRequest<{ key: string; value: AppSettings } | undefined>(
    SETTINGS_STORE,
    "readonly",
    (store) => store.get("app"),
  );
  return { ...DEFAULT_SETTINGS, ...(result?.value ?? {}) };
};

export const saveSettings = (settings: AppSettings): Promise<IDBValidKey> =>
  runRequest<IDBValidKey>(SETTINGS_STORE, "readwrite", (store) =>
    store.put({ key: "app", value: settings }),
  );

export const clearLocalData = async (): Promise<void> => {
  const database = await openDatabase();
  await Promise.all(
    [ROOMS_STORE, SETTINGS_STORE].map(
      (storeName) =>
        new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(storeName, "readwrite");
          const request = transaction.objectStore(storeName).clear();
          request.onsuccess = () => resolve();
          request.onerror = () =>
            reject(request.error ?? new Error("Could not clear local data."));
        }),
    ),
  );
  database.close();
};
