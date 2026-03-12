import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

export const APP_VERSION = 61;
console.log("[BabyJournal] Build v61");

createRoot(document.getElementById("root")!).render(<App />);
