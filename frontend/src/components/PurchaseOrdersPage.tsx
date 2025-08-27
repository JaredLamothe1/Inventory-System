// src/pages/PurchaseOrdersPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api";

type POItem = { id: number; product_id: number; product_name: string; category_name?: string | null; quantity: number; unit_cost: number; };
type PurchaseOrder = { id: number; created_at: string; shipping_cost: number; handling_cost: number; items: POItem[]; };
type SortKey = "date" | "units" | "lines" | "grand_total";

function apiUrl(path: string) {
  const base = (api as any)?.defaults?.baseURL || (import.meta.env as any)?.VITE_API_URL || "";
  const clean = String(base).replace(/\/+$/, "");
  return clean ? `${clean}${path}` : path;
}
const money = (n: number) => (n ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const dateOnly = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const totals = (po: PurchaseOrder) => {
  const itemsSubtotal = (po.items ?? []).reduce((a, it) => a + (it.quantity || 0) * (it.unit_cost || 0), 0) ?? 0;
  const grand = itemsSubtotal + (po.shipping_cost ?? 0) + (po.handling_cost ?? 0);
  const units = (po.items ?? []).reduce((a, it) => a + (it.quantity || 0), 0) ?? 0;
  const lines = po.items?.length ?? 0;
  return { itemsSubtotal, grand, units, lines };
};

export default function PurchaseOrdersPage() {
  const nav = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const ROWS_PER_PAGE = 25;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true); setErr(null);
        const { data } = await api.get<PurchaseOrder[]>(apiUrl("/purchase_orders/"));
        if (alive) setOrders(Array.isArray(data) ? data : []);
      } catch (e: any) {
        const msg = e?.response?.data?.detail || e?.response?.data?.message || e?.message || "Failed to fetch purchase orders.";
        if (alive) setErr(String(msg));
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const start = fromDate ? new Date(fromDate + "T00:00:00") : null;
    const end = toDate ? new Date(toDate + "T23:59:59") : null;
    return orders.filter(po => {
      const d = new Date(po.created_at);
      if (start && d < start) return false;
      if (end && d > end) return false;
      if (words.length === 0) return true;
      const hay = [
        dateOnly(po.created_at),
        String(po.id),
        ...(po.items ?? []).map(it => it.product_name || ""),
        ...(po.items ?? []).map(it => it.category_name || ""),
      ].join(" ").toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }, [orders, query, fromDate, toDate]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const ta = totals(a), tb = totals(b);
      let cmp = 0;
      switch (sortKey) {
        case "date": cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case "units": cmp = ta.units - tb.units; break;
        case "lines": cmp = ta.lines - tb.lines; break;
        case "grand_total": cmp = ta.grand - tb.grand; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  useEffect(() => { if (page !== pageClamped) setPage(pageClamped); }, [totalPages]);
  const paged = useMemo(() => sorted.slice((pageClamped - 1) * ROWS_PER_PAGE, pageClamped * ROWS_PER_PAGE), [sorted, pageClamped]);

  const toggleSort = (k: SortKey) => { if (k === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("desc"); } setPage(1); };
  const clearFilters = () => { setQuery(""); setFromDate(""); setToDate(""); setPage(1); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-sm text-slate-500">Filter by text or date. Sort by date, units, lines, or grand total.</p>
        </div>
        <button onClick={() => nav("/purchase-orders/new")} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">+ New PO</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Search</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Products, categories, ID…"
              value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-end">
            <button onClick={clearFilters} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">Clear</button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">
                <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort("date")}>
                  Date {sortKey === "date" && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort("units")}>
                  Units {sortKey === "units" && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort("lines")}>
                  Lines {sortKey === "lines" && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort("grand_total")}>
                  Grand Total {sortKey === "grand_total" && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                </button>
              </th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(po => {
              const t = totals(po);
              return (
                <tr key={po.id} className="border-t">
                  <td className="px-4 py-3">{dateOnly(po.created_at)}</td>
                  <td className="px-4 py-3">{t.units}</td>
                  <td className="px-4 py-3">{t.lines}</td>
                  <td className="px-4 py-3 text-right font-medium">{money(t.grand)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => nav(`/purchase-orders/${po.id}`)} className="text-blue-700 hover:underline">View</button>
                  </td>
                </tr>
              );
            })}
            {paged.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No purchase orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pager */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1 pt-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={[
                "min-w-[2.25rem] rounded-lg border px-3 py-1 text-sm",
                page === i + 1 ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white hover:bg-slate-50"
              ].join(" ")}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
