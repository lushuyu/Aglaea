"use client";

import * as React from "react";

/* ── Input ───────────────────────────────────────────────────────────────── */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ style, onFocus, onBlur, ...props }, ref) => {
    const baseStyle: React.CSSProperties = {
      width: "100%",
      height: "34px",
      padding: "0 12px",
      background: "var(--bg-input)",
      border: "1px solid var(--line-2)",
      borderRadius: "var(--radius)",
      color: "var(--fg-0)",
      fontFamily: "inherit",
      fontSize: "inherit",
      outline: "none",
      transition: "border-color var(--motion-fast) var(--ease), box-shadow var(--motion-fast) var(--ease)",
      ...style,
    };

    return (
      <input
        ref={ref}
        style={baseStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--line-focus)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-soft)";
          onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "";
          e.currentTarget.style.boxShadow = "";
          onBlur?.(e);
        }}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

/* ── Textarea ─────────────────────────────────────────────────────────────── */
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ style, onFocus, onBlur, ...props }, ref) => {
    const baseStyle: React.CSSProperties = {
      width: "100%",
      padding: "10px 12px",
      background: "var(--bg-input)",
      border: "1px solid var(--line-2)",
      borderRadius: "var(--radius)",
      color: "var(--fg-0)",
      fontFamily: "var(--font-mono)",
      fontSize: "var(--fs-13)",
      lineHeight: 1.5,
      outline: "none",
      resize: "vertical",
      transition: "border-color var(--motion-fast) var(--ease), box-shadow var(--motion-fast) var(--ease)",
      ...style,
    };

    return (
      <textarea
        ref={ref}
        style={baseStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--line-focus)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-soft)";
          onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "";
          e.currentTarget.style.boxShadow = "";
          onBlur?.(e);
        }}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
