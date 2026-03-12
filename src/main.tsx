import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

export const APP_VERSION = 59;
console.log("[BabyJournal] Build v59");

createRoot(document.getElementById("root")!).render(<App />);
