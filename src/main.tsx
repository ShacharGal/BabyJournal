import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "@/lib/pushNotifications";

export const APP_VERSION = 80;
console.log("[BabyJournal] Build v80");

// Register service worker for push notifications
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
