import React from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.tsx";
import "./index.css";
import { captureFirstTouch } from "./lib/first-touch";

// Record where this browser first came from before any in-app navigation
// rewrites the URL (see src/lib/first-touch.ts).
captureFirstTouch();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Analytics />
  </React.StrictMode>
);
