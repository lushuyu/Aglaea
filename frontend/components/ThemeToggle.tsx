"use client";

import { useState, useEffect } from "react";

/**
 * ThemeToggle — floating bottom-left button that toggles theme-light / theme-dark
 * on the <html> element. Defaults to light theme per production spec (no TweaksPanel).
 */
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Read persisted preference
    const stored = localStorage.getItem("aglaea-theme");
    const prefersDark =
      stored === "dark" ||
      (!stored &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setIsDark(prefersDark);
    applyTheme(prefersDark);
  }, []);

  function applyTheme(dark: boolean) {
    const root = document.documentElement;
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add(dark ? "theme-dark" : "theme-light");
  }

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    applyTheme(next);
    localStorage.setItem("aglaea-theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      className="theme-toggle"
      aria-label="Toggle theme"
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        width: 32,
        height: 32,
        background: "var(--bg-2)",
        border: "1px solid var(--line-2)",
        borderRadius: "999px",
        color: "var(--fg-2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "default",
        transition: "all 120ms ease",
        zIndex: 30,
      }}
    >
      {isDark ? (
        // Sun icon
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 1.5a.5.5 0 011 0V3a.5.5 0 01-1 0V1.5zM11 2.5l1-1 .7.7-1 1zM2.3 2.2L3 1.5l1 1-.7.7zM1.5 7a.5.5 0 010-1H3a.5.5 0 010 1H1.5zM10 9c0 1.66-1.34 3-3 3S4 10.66 4 9s1.34-3 3-3 3 1.34 3 3zM13.5 7a.5.5 0 010-1H15a.5.5 0 010 1h-1.5zM12 13.5l-1-1 .7-.7 1 1zM3 12.5l-.7.7-1-1 .7-.7zM7 13a.5.5 0 011 0v1.5a.5.5 0 01-1 0V13z" />
        </svg>
      ) : (
        // Moon icon
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 .278a.77.77 0 01.08.858 7.2 7.2 0 00-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.77.77 0 01.858.43.77.77 0 01-.36.99A8.5 8.5 0 011 8.5C1 4.79 3.395 1.59 6.732.279.696.241.85.247 1.018.278z" />
        </svg>
      )}
    </button>
  );
}
