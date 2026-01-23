import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./global.css";
import { registerServiceWorker } from "@utils";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Avoid registering the service worker during local dev where Vite's HMR
// already handles updates; stale SW caches can ship an old React bundle and
// trigger "Invalid hook call" after a normal refresh. Restrict to prod builds
// so the page always loads the same React instance as the renderer.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    registerServiceWorker();
  });
}
