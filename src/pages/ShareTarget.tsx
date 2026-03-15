import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const DB_NAME = "babyjournal-share";
const STORE_NAME = "pending-files";
const RECORD_KEY = "shared";

async function consumeSharedFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(RECORD_KEY);
      getReq.onsuccess = () => {
        const files: File[] = getReq.result || [];
        store.delete(RECORD_KEY);
        tx.oncomplete = () => { db.close(); resolve(files); };
      };
      getReq.onerror = () => { db.close(); resolve([]); };
    };
    req.onerror = () => resolve([]);
  });
}

export default function ShareTarget() {
  const navigate = useNavigate();

  useEffect(() => {
    console.log("[ShareTarget] Page mounted, reading IndexedDB");
    consumeSharedFiles().then((files) => {
      console.log("[ShareTarget] Consumed", files.length, "file(s)");
      navigate("/", {
        replace: true,
        state: { sharedFiles: files },
      });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}
