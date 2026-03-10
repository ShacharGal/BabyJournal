import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

export const APP_VERSION = 38;
console.log("[BabyJournal] Build v38");

createRoot(document.getElementById("root")!).render(<App />);
