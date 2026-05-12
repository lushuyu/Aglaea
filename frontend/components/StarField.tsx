"use client";

import { useMemo } from "react";

interface Star {
  x: number;
  y: number;
  s: number;
  o: number;
  d: number;
}

export default function StarField() {
  const stars = useMemo<Star[]>(() => {
    // Deterministic seeded RNG — matches prototype
    let seed = 7;
    const r = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: 90 }, () => ({
      x: r() * 100,
      y: r() * 100,
      s: r() * 1.4 + 0.3,
      o: r() * 0.5 + 0.15,
      d: r() * 4 + 2,
    }));
  }, []);

  return (
    <div className="starfield" aria-hidden="true">
      <svg
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0 }}
      >
        {stars.map((star, i) => (
          <circle
            key={i}
            cx={star.x + "%"}
            cy={star.y + "%"}
            r={star.s}
            fill="var(--gold-200)"
            opacity={star.o}
          >
            <animate
              attributeName="opacity"
              values={`${star.o};${star.o * 0.3};${star.o}`}
              dur={star.d + "s"}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </svg>
    </div>
  );
}
