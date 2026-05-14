"use client";

import * as React from "react";
import clsx from "clsx";

export type ButtonVariant = "default" | "destructive" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  default: {
    background: "var(--accent)",
    color: "#1a1305",
    border: "1px solid var(--accent)",
    fontWeight: 600,
  },
  destructive: {
    background: "var(--down-soft)",
    color: "var(--down)",
    border: "1px solid var(--down-line)",
  },
  outline: {
    background: "var(--bg-2)",
    color: "var(--fg-1)",
    border: "1px solid var(--line-2)",
  },
  ghost: {
    background: "transparent",
    color: "var(--fg-1)",
    border: "1px solid transparent",
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { height: "26px", padding: "0 10px", fontSize: "12px" },
  md: { height: "32px", padding: "0 14px", fontSize: "var(--fs-13)" },
  lg: { height: "40px", padding: "0 18px", fontSize: "var(--fs-14)" },
};

const hoverStyles: Record<ButtonVariant, Partial<React.CSSProperties>> = {
  default: { background: "var(--gold-300)", borderColor: "var(--gold-300)" },
  destructive: { background: "var(--down-soft)", color: "var(--down)" },
  outline: { background: "var(--bg-3)", borderColor: "var(--line-3)", color: "var(--fg-0)" },
  ghost: { background: "var(--bg-2)", borderColor: "var(--line-2)" },
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "default",
      size = "md",
      className,
      style,
      onMouseEnter,
      onMouseLeave,
      onMouseDown,
      onMouseUp,
      ...props
    },
    ref
  ) => {
    const baseStyle: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      borderRadius: "var(--radius)",
      fontFamily: "inherit",
      fontWeight: 500,
      cursor: props.disabled ? "not-allowed" : "default",
      opacity: props.disabled ? 0.5 : 1,
      transition: "all var(--motion-fast) var(--ease)",
      whiteSpace: "nowrap",
      userSelect: "none",
      ...variantStyles[variant],
      ...sizeStyles[size],
      ...style,
    };

    return (
      <button
        ref={ref}
        className={clsx(className)}
        style={baseStyle}
        onMouseEnter={(e) => {
          if (!props.disabled) {
            Object.assign(e.currentTarget.style, hoverStyles[variant]);
          }
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          if (!props.disabled) {
            Object.assign(e.currentTarget.style, variantStyles[variant]);
          }
          onMouseLeave?.(e);
        }}
        onMouseDown={(e) => {
          if (!props.disabled) {
            e.currentTarget.style.transform = "scale(0.97)";
          }
          onMouseDown?.(e);
        }}
        onMouseUp={(e) => {
          if (!props.disabled) {
            e.currentTarget.style.transform = "";
          }
          onMouseUp?.(e);
        }}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
