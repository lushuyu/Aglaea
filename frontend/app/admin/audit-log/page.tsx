"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { adminListAuditLog } from "@/lib/api";
import { fmtSGT } from "@/lib/fmt";
import type { AuditLog } from "@/types/api";

const PAGE_SIZE = 50;

const columnHelper = createColumnHelper<AuditLog>();

const columns = [
  columnHelper.accessor("t", {
    id: "t",
    header: "Time (SGT)",
    enableSorting: true,
    enableColumnFilter: false,
    cell: (info) => (
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--fg-3)",
          whiteSpace: "nowrap",
        }}
      >
        {fmtSGT(new Date(info.getValue()))}
      </span>
    ),
  }),
  columnHelper.accessor("actor", {
    id: "actor",
    header: "Actor",
    enableSorting: true,
    enableColumnFilter: false,
    cell: (info) => (
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 16,
          color:
            info.row.original.actor_type === "user"
              ? "var(--fg-1)"
              : "var(--fg-3)",
        }}
      >
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("event", {
    id: "event",
    header: "Event",
    enableSorting: true,
    enableColumnFilter: true,
    cell: (info) => (
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 16,
          color: "var(--accent)",
        }}
      >
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("ip", {
    id: "ip",
    header: "IP",
    enableSorting: false,
    enableColumnFilter: false,
    cell: (info) => (
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--fg-3)",
        }}
      >
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("details", {
    id: "details",
    header: "Details",
    enableSorting: false,
    enableColumnFilter: false,
    cell: (info) => (
      <details>
        <summary
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--fg-3)",
            cursor: "pointer",
          }}
        >
          view
        </summary>
        <div className="audit-details">
          <pre>{JSON.stringify(info.getValue(), null, 2)}</pre>
        </div>
      </details>
    ),
  }),
];

export default function AdminAuditLogPage() {
  const [offset, setOffset] = useState(0);
  // Server-side event filter (passed to API for pre-filtering)
  const [serverEventFilter, setServerEventFilter] = useState("");
  // Client-side react-table column filter state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  // Local filter input value (drives both server filter and column filter)
  const [filterInput, setFilterInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", offset, serverEventFilter],
    queryFn: () =>
      adminListAuditLog({
        limit: PAGE_SIZE,
        offset,
        event: serverEventFilter || undefined,
      }),
    refetchInterval: 30_000,
  });

  const entries: AuditLog[] = useMemo(() => data?.entries ?? [], [data]);
  const total = data?.total ?? 0;

  const table = useReactTable({
    data: entries,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Manually paginated — server provides pages
    manualPagination: true,
    pageCount: Math.ceil(total / PAGE_SIZE),
  });

  function handleFilterChange(value: string) {
    setFilterInput(value);
    // Apply client-side column filter for immediate feedback
    setColumnFilters(value ? [{ id: "event", value }] : []);
    // Also reset server filter + pagination on user change
    setServerEventFilter(value);
    setOffset(0);
  }

  const rows = table.getRowModel().rows;

  return (
    <div className="admin-page">
      <div className="admin-page-hd">
        <h1 className="admin-h2">Audit log</h1>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 16,
            color: "var(--fg-3)",
          }}
        >
          {total} entries
        </span>
      </div>

      {/* Filter — matches original input styling exactly */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Filter by event type…"
          value={filterInput}
          onChange={(e) => handleFilterChange(e.target.value)}
          style={{
            background: "var(--bg-0)",
            color: "var(--fg-0)",
            border: "1px solid var(--line-2)",
            borderRadius: "var(--radius)",
            padding: "6px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: 16,
            width: 280,
          }}
        />
      </div>

      {isLoading && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 16,
            color: "var(--fg-3)",
            padding: "32px 0",
          }}
        >
          Loading…
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 16,
            color: "var(--fg-3)",
            padding: "32px 0",
          }}
        >
          No entries found.
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* React-table rendered table — identical CSS classes to original */}
          <table className="admin-table">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sortDir = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        style={{
                          cursor: canSort ? "pointer" : "default",
                          userSelect: canSort ? "none" : undefined,
                        }}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {canSort && (
                          <span
                            style={{
                              marginLeft: 4,
                              color: sortDir ? "var(--accent)" : "var(--fg-4)",
                              fontSize: 10,
                            }}
                          >
                            {sortDir === "asc"
                              ? " ▲"
                              : sortDir === "desc"
                              ? " ▼"
                              : " ⇅"}
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination — identical to original */}
          {total > PAGE_SIZE && (
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                marginTop: 20,
                fontFamily: "var(--font-mono)",
                fontSize: 16,
                color: "var(--fg-3)",
              }}
            >
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                style={{
                  padding: "4px 12px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--line-2)",
                  borderRadius: "var(--radius)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  cursor: offset === 0 ? "default" : "pointer",
                  opacity: offset === 0 ? 0.5 : 1,
                  color: "var(--fg-1)",
                }}
              >
                prev
              </button>
              <span>
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                style={{
                  padding: "4px 12px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--line-2)",
                  borderRadius: "var(--radius)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  cursor:
                    offset + PAGE_SIZE >= total ? "default" : "pointer",
                  opacity: offset + PAGE_SIZE >= total ? 0.5 : 1,
                  color: "var(--fg-1)",
                }}
              >
                next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
