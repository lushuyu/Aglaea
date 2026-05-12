"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TABS = [
  { href: "/", label: "Status", sub: "live", icon: "◎" },
  { href: "/claude-code", label: "Claude Code", sub: "analytics", icon: "⟡" },
  { href: "/about", label: "About", sub: "info", icon: "✦" },
];

export default function PubTabBar() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setHidden(y > lastY.current && y > 80);
      lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`pub-tabbar${hidden ? " is-hidden" : ""}`}>
      <div className="pub-tabbar-inner">
        {TABS.map((t) => {
          const isOn =
            t.href === "/"
              ? pathname === "/" || pathname.startsWith("/services")
              : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`pub-tab${isOn ? " on" : ""}`}
              style={{ textDecoration: "none" }}
            >
              <span className="pub-tab-icon">{t.icon}</span>
              <span>
                <div className="pub-tab-label">{t.label}</div>
                <div className="pub-tab-sub">{t.sub}</div>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
