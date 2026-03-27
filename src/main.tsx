import { Buffer } from "buffer";
// @ts-ignore - Inyectamos Buffer globalmente para las librerías de 2FA
window.Buffer = Buffer;

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);