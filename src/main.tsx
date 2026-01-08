import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./global.css";
import { registerFieldKitServiceWorker } from "./utils/offlineClient";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    registerFieldKitServiceWorker();
  });
}
