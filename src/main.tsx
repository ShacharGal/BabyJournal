import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("[BabyJournal] Build v2");

createRoot(document.getElementById("root")!).render(<App />);
