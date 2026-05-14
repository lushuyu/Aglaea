import * as React from "react";

interface Props {
  error: Error | null;
  onDismiss?: () => void;
}

export default function MutationErrorBanner({ error, onDismiss }: Props) {
  if (!error) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 16,
        padding: "10px 14px",
        background: "var(--down-soft)",
        border: "1px solid var(--down-line)",
        borderRadius: "var(--radius)",
        fontSize: 12,
        color: "var(--fg-2)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <span style={{ flex: 1, wordBreak: "break-word" }}>{error.message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss error"
          style={{
            flexShrink: 0,
            background: "none",
            border: "none",
            padding: "0 2px",
            cursor: "pointer",
            color: "var(--fg-3)",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
}
