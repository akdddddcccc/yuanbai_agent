import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { Portal } from "./Portal.jsx";
import "./styles.css";

// 同一份前端按路径切换：根路径是工作台，/dialogue/ 是原有语音体验。
// 这样部署到子目录时仍共用一套 Three.js 模型和样式资源。
const normalizedPath = globalThis.location.pathname.replace(/\/+$/, "");
const CurrentPage = normalizedPath.endsWith("/dialogue") ? App : Portal;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CurrentPage />
  </React.StrictMode>,
);
