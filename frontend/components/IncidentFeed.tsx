"use client";

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { listAllIncidents, type IncidentWithService } from "@/lib/api";

type CursorParam = { beforeTs?: string; beforeId?: string };

export default function IncidentFeed() {
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["public-incidents"],
    initialPageParam: {} as CursorParam,
    queryFn: ({ pageParam }: { pageParam: CursorParam }) =>
      listAllIncidents({ limit: 20, ...pageParam }),
    getNextPageParam: (lastPage: IncidentWithService[]): CursorParam | undefined => {
      const last = lastPage[lastPage.length - 1];
      return last
        ? { beforeTs: last.started_at, beforeId: String(last.id) }
        : undefined;
    },
  });

  // Head poll — every 60s, fetch page 0 and merge any new incidents at the
  // front of page[0]. TanStack Query v5 removed `onSuccess` on useQuery, so
  // the merge happens INSIDE queryFn against the cached InfiniteData.
  useQuery({
    queryKey: ["public-incidents-head"],
    queryFn: async () => {
      const head = await listAllIncidents({ limit: 20 });
      queryClient.setQueryData<InfiniteData<IncidentWithService[]>>(
        ["public-incidents"],
        (old) => {
          if (!old) return old;
          const existingIds = new Set(old.pages.flat().map((i) => i.id));
          const newOnes = head.filter((i) => !existingIds.has(i.id));
          if (newOnes.length === 0) return old;
          const newPage0 = [...newOnes, ...old.pages[0]];
          return { ...old, pages: [newPage0, ...old.pages.slice(1)] };
        }
      );
      return head;
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px", threshold: 0 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const items: IncidentWithService[] = data?.pages.flat() ?? [];

  if (isLoading) {
    return <div className="incident-feed__skeleton">Loading…</div>;
  }
  if (items.length === 0) {
    return <div className="incident-feed__empty">No incidents recorded.</div>;
  }

  return (
    <ul className="incident-feed">
      <AnimatePresence initial={false}>
        {items.map((inc) => (
          <motion.li
            key={inc.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="incident-feed__row"
          >
            <Link
              href={`/services/${inc.service_slug}/incidents`}
              className="incident-feed__link"
            >
              <span className="incident-feed__service">{inc.service_name}</span>
              <span
                className={`incident-feed__status incident-feed__status--${inc.status}`}
              >
                {inc.status}
              </span>
              <span className="incident-feed__duration">
                {formatDuration(inc.started_at, inc.resolved_at)}
              </span>
              <time
                className="incident-feed__time"
                dateTime={inc.started_at}
              >
                {new Date(inc.started_at).toLocaleString()}
              </time>
            </Link>
          </motion.li>
        ))}
      </AnimatePresence>
      <div ref={sentinelRef} aria-hidden style={{ height: 1 }} />
      {isFetchingNextPage && (
        <li className="incident-feed__skeleton">Loading more…</li>
      )}
    </ul>
  );
}

function formatDuration(start: string, end?: string | null): string {
  if (!end) return "ongoing";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
