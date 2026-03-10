import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

export const APP_VERSION = 39;
console.log("[BabyJournal] Build v39");

createRoot(document.getElementById("root")!).render(<App />);
