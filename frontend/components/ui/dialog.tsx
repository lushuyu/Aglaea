"use client";

import * as React from "react";
import * as RadixDialog from "@radix-ui/react-dialog";

/* ── Dialog root re-exports ─────────────────────────────────────────────── */
export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

/* ── Overlay ─────────────────────────────────────────────────────────────── */
export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Overlay>
>(({ style, ...props }, ref) => (
  <RadixDialog.Overlay
    ref={ref}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 50,
      background: "rgba(10, 12, 17, 0.72)",
      backdropFilter: "blur(2px)",
      animation: "fadeIn var(--motion) var(--ease)",
      ...style,
    }}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

/* ── Content ─────────────────────────────────────────────────────────────── */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Content>
>(({ style, children, ...props }, ref) => (
  <RadixDialog.Portal>
    <DialogOverlay />
    <RadixDialog.Content
      ref={ref}
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 51,
        width: "100%",
        maxWidth: "480px",
        maxHeight: "85vh",
        overflowY: "auto",
        background: "var(--bg-2)",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-2)",
        padding: "24px",
        animation: "modalEnter 220ms var(--ease) both",
        ...style,
      }}
      {...props}
    >
      {children}
    </RadixDialog.Content>
  </RadixDialog.Portal>
));
DialogContent.displayName = "DialogContent";

/* ── Header / Footer / Title / Description ─────────────────────────────── */
export function DialogHeader({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        marginBottom: "16px",
        ...style,
      }}
      {...props}
    />
  );
}

export function DialogFooter({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: "8px",
        marginTop: "24px",
        ...style,
      }}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Title>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Title>
>(({ style, ...props }, ref) => (
  <RadixDialog.Title
    ref={ref}
    style={{
      fontSize: "var(--fs-16)",
      fontWeight: 500,
      color: "var(--fg-0)",
      margin: 0,
      ...style,
    }}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Description>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Description>
>(({ style, ...props }, ref) => (
  <RadixDialog.Description
    ref={ref}
    style={{
      fontSize: "var(--fs-13)",
      color: "var(--fg-2)",
      margin: 0,
      ...style,
    }}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";
