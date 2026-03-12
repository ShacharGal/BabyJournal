import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

export const APP_VERSION = 54;
console.log("[BabyJournal] Build v54");

createRoot(document.getElementById("root")!).render(<App />);
