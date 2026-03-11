import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

export const APP_VERSION = 45;
console.log("[BabyJournal] Build v45");

createRoot(document.getElementById("root")!).render(<App />);
