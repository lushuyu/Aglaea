"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/** Unix-ms timestamp that refreshes every 30 s, for RSC re-renders / relative times. */
const LiveTickContext = createContext<number>(Date.now());

export function LiveTickProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <LiveTickContext.Provider value={tick}>{children}</LiveTickContext.Provider>
  );
}

export function useLiveTick(): number {
  return useContext(LiveTickContext);
}
