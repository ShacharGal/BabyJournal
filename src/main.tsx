import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

export const APP_VERSION = 42;
console.log("[BabyJournal] Build v42");

createRoot(document.getElementById("root")!).render(<App />);
