import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

export const APP_VERSION = 62;
console.log("[BabyJournal] Build v62");

createRoot(document.getElementById("root")!).render(<App />);
