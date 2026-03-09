import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("[BabyJournal] Build v17");

createRoot(document.getElementById("root")!).render(<App />);
