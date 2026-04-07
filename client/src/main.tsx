import { createRoot } from "react-dom/client";
import App from "./App";
import "@puckeditor/core/puck.css";
import "./index.css";
import "./i18n";

createRoot(document.getElementById("root")!).render(<App />);
