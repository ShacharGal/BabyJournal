import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "@/lib/pushNotifications";

export const APP_VERSION = 81;
console.log("[BabyJournal] Build v81");

// Register service worker for push notifications
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
