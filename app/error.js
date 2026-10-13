"use client";
import { useEffect } from "react";

/* App-level error boundary. Shows a friendly reload instead of a raw white
   screen, and auto-recovers chunk-load errors (which happen when a new
   version deploys while someone has the app open) by reloading once. */
export default function Error({ error, reset }) {
  useEffect(() => {
    const msg = `${error?.name || ""} ${error?.message || ""}`;
    if (/ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed/i.test(msg)) {
      try {
        if (!sessionStorage.getItem("fw_reloaded_once")) {
          sessionStorage.setItem("fw_reloaded_once", "1");
          window.location.reload();
        }
      } catch {
        /* ignore */
      }
    }
  }, [error]);

  const reload = () => {
    try {
      window.location.reload();
    } catch {
      reset && reset();
    }
  };

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 48,
        maxWidth: 560,
        margin: "0 auto",
        textAlign: "center",
        color: "#0E1B2C",
      }}
    >
      <h2 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h2>
      <p style={{ color: "#5b6472", margin: "0 0 16px" }}>
        Please reload the page. If it keeps happening, reply to our email and we'll help.
      </p>
      <button
        onClick={reload}
        style={{
          padding: "10px 18px",
          borderRadius: 4,
          border: "none",
          background: "#1F49E0",
          color: "#fff",
          fontWeight: 700,
          cursor: "pointer",
          font: "inherit",
        }}
      >
        Reload
      </button>
    </div>
  );
}
