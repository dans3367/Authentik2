import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "@puckeditor/core/puck.css";
import "./i18n";

createRoot(document.getElementById("root")!).render(<App />);
