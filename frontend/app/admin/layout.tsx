import type { ReactNode } from "react";
import Link from "next/link";
import { LiveTickProvider } from "@/components/LiveTickProvider";
import Brandmark from "@/components/Brandmark";
import ThemeToggle from "@/components/ThemeToggle";
import "@/styles/screens/common.css";
import "@/styles/screens/admin-shell.css";
import "@/styles/screens/admin-dashboard.css";
import "@/styles/screens/admin-services.css";
import "@/styles/screens/admin-incident-review.css";
import "@/styles/screens/admin-claude-code.css";
import "@/styles/screens/admin-audit.css";
import "@/styles/screens/admin-settings.css";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "◎" },
  { href: "/admin/services", label: "Services", icon: "⟡" },
  { href: "/admin/incidents", label: "Incidents", icon: "⚡" },
  { href: "/admin/claude-code", label: "Claude Code", icon: "✦" },
  { href: "/admin/audit-log", label: "Audit Log", icon: "≡" },
  { href: "/admin/settings", label: "Settings", icon: "⚙" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <LiveTickProvider>
        <div className="admin-shell">
          <aside className="admin-sidebar">
            <div style={{ padding: "20px 16px 12px" }}>
              <Link
                href="/admin"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textDecoration: "none",
                }}
              >
                <Brandmark size={24} />
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 16,
                    color: "var(--fg-0)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Aglaea
                </span>
              </Link>
            </div>

            <nav className="admin-nav">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="admin-nav-item"
                  style={{ textDecoration: "none" }}
                >
                  <span className="admin-nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="admin-side-foot">
              <Link
                href="/"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--fg-3)",
                  textDecoration: "none",
                }}
              >
                ← Public status
              </Link>
            </div>
          </aside>

          <main className="admin-main">{children}</main>
        </div>

        <ThemeToggle />
      </LiveTickProvider>
  );
}
