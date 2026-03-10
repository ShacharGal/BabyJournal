import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

export const APP_VERSION = 37;
console.log("[BabyJournal] Build v37");

createRoot(document.getElementById("root")!).render(<App />);
