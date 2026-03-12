import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

export const APP_VERSION = 63;
console.log("[BabyJournal] Build v63");

createRoot(document.getElementById("root")!).render(<App />);
