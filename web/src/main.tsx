import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@pior-labs/design-system";
import { App } from "./app.js";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
