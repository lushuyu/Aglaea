import type { ReactNode } from "react";
import Link from "next/link";
import Brandmark from "@/components/Brandmark";
import StarField from "@/components/StarField";
import LocalClock from "@/components/LocalClock";
import ThemeToggle from "@/components/ThemeToggle";
import PubTabBar from "@/components/PubTabBar";
import "@/styles/screens/common.css";
import "@/styles/screens/public-overview.css";
import "@/styles/screens/public-service.css";
import "@/styles/screens/public-incident.css";
import "@/styles/screens/public-claude-code.css";
import "@/styles/screens/public-about.css";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StarField />
      <header className="pub-header">
        <Link href="/" className="brand-link" style={{ textDecoration: "none" }}>
          <Brandmark size={28} />
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              letterSpacing: "-0.02em",
            }}
          >
            Aglaea
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <LocalClock />
          <Link href="/admin" className="pub-nav-cta" style={{ textDecoration: "none" }}>
            Admin
          </Link>
        </div>
      </header>

      <PubTabBar />

      <main className="pub-main">{children}</main>

      <footer className="pub-footer">
        <div className="pub-footer-inner">
          <div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 15,
                color: "var(--fg-1)",
                marginBottom: 4,
              }}
            >
              Aglaea
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--fg-3)",
              }}
            >
              Service status &amp; signal
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 24,
              fontSize: 13,
              color: "var(--fg-3)",
            }}
          >
            <Link href="/" style={{ color: "var(--fg-3)" }}>
              Status
            </Link>
            <Link href="/claude-code" style={{ color: "var(--fg-3)" }}>
              Claude Code
            </Link>
            <Link href="/about" style={{ color: "var(--fg-3)" }}>
              About
            </Link>
          </div>
        </div>
      </footer>

      <ThemeToggle />
    </>
  );
}
