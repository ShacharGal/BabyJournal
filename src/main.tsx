import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

export const APP_VERSION = 50;
console.log("[BabyJournal] Build v50");

createRoot(document.getElementById("root")!).render(<App />);
