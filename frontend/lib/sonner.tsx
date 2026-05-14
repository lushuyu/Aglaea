"use client";

import { Toaster } from "sonner";

/**
 * SonnerProvider — mounts sonner's <Toaster /> once at the layout root.
 * Styled to match the Aglaea dark theme (gold accent, cool-ink ground).
 */
export function SonnerProvider() {
  return (
    <Toaster
      position="bottom-right"
      theme="dark"
      toastOptions={{
        style: {
          background: "var(--bg-2)",
          border: "1px solid var(--line-2)",
          color: "var(--fg-1)",
          fontFamily: "var(--font-serif)",
          fontSize: "var(--fs-13)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-2)",
        },
      }}
    />
  );
}
