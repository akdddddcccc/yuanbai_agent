import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { Portal } from "./Portal.jsx";
import { PublicPortal } from "./PublicPortal.jsx";
import { usePersonalPortal } from "./personalPortalDomain.js";
import "./styles.css";
import { preloadModel } from "./preloadModel.js";
import { stopIntroAudio } from "./introAudio.js";

preloadModel().catch(() => {});

// 同一份前端按路径切换：根路径是工作台，/dialogue/ 是原有语音体验。
// 这样部署到子目录时仍共用一套 Three.js 模型和样式资源。
function Root() {
  const [path, setPath] = useState(() => globalThis.location.pathname);
  useEffect(() => {
    const onPopState = () => {
      if (!globalThis.location.pathname.replace(/\/+$/, "").endsWith("/dialogue")) stopIntroAudio();
      setPath(globalThis.location.pathname);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const enterDialogue = useCallback(() => {
    // Begin inside the entry click/key press, then switch views without a reload.
    stopIntroAudio();
    window.history.pushState(null, "", `${import.meta.env.BASE_URL}dialogue/`);
    setPath(window.location.pathname);
  }, []);

  return path.replace(/\/+$/, "").endsWith("/dialogue")
    ? <App />
    : (import.meta.env.VITE_YUANBAI_PUBLIC_EDITION === "true" || usePersonalPortal(globalThis.location.hostname, import.meta.env.DEV))
      ? <PublicPortal onEnterDialogue={enterDialogue} />
      : <Portal onEnterDialogue={enterDialogue} />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
