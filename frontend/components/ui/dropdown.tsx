"use client";

import * as React from "react";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";

/* ── Root re-exports ─────────────────────────────────────────────────────── */
export const DropdownMenu = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;
export const DropdownMenuGroup = RadixDropdown.Group;
export const DropdownMenuSeparator = RadixDropdown.Separator;
export const DropdownMenuSub = RadixDropdown.Sub;
export const DropdownMenuSubTrigger = RadixDropdown.SubTrigger;
export const DropdownMenuRadioGroup = RadixDropdown.RadioGroup;

/* ── Content ─────────────────────────────────────────────────────────────── */
export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Content>
>(({ style, sideOffset = 4, ...props }, ref) => (
  <RadixDropdown.Portal>
    <RadixDropdown.Content
      ref={ref}
      sideOffset={sideOffset}
      style={{
        minWidth: "160px",
        background: "var(--bg-2)",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-2)",
        padding: "4px",
        zIndex: 50,
        animation: "fadeIn var(--motion-fast) var(--ease)",
        ...style,
      }}
      {...props}
    />
  </RadixDropdown.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

/* ── Item ─────────────────────────────────────────────────────────────────── */
export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.Item>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Item> & { inset?: boolean }
>(({ style, inset, ...props }, ref) => (
  <RadixDropdown.Item
    ref={ref}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      height: "32px",
      padding: inset ? "0 8px 0 28px" : "0 8px",
      borderRadius: "var(--radius-sm)",
      fontSize: "var(--fs-13)",
      color: "var(--fg-1)",
      cursor: "default",
      outline: "none",
      transition: "background var(--motion-fast) var(--ease), color var(--motion-fast) var(--ease)",
      ...style,
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.background = "var(--bg-4)";
      (e.currentTarget as HTMLElement).style.color = "var(--fg-0)";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.background = "";
      (e.currentTarget as HTMLElement).style.color = "";
    }}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

/* ── Destructive item ────────────────────────────────────────────────────── */
export const DropdownMenuDestructiveItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.Item>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Item>
>(({ style, ...props }, ref) => (
  <DropdownMenuItem
    ref={ref}
    style={{ color: "var(--down)", ...style }}
    {...props}
  />
));
DropdownMenuDestructiveItem.displayName = "DropdownMenuDestructiveItem";

/* ── Label ───────────────────────────────────────────────────────────────── */
export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.Label>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Label>
>(({ style, ...props }, ref) => (
  <RadixDropdown.Label
    ref={ref}
    style={{
      padding: "4px 8px",
      fontSize: "11px",
      fontWeight: 500,
      color: "var(--fg-3)",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      ...style,
    }}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";
