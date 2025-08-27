// src/pages/PurchaseOrdersPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api";

type POItem = {
  id: number;
  product_id: number;
  product_name?: string | null;
  quantity: number;
  unit_cost: number;
};
type PurchaseOrder = {
  id: number;
  created_at: string;
  shipping_cost?: number | null;
  handling_cost?: number | null;
  items?: POItem[] | null;
};
type SortKey = "date" | "units" | "lines" | "grand_total";

const money = (n: number) => (n ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const dateOnly = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export default function PurchaseOrdersPage() {
  const nav = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data } = await api.get<PurchaseOrder[]>("/purchase_orders/");
        const arr = Array.isArray(data) ? data : [];
        const sorted = arr.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        if (alive) setOrders(sorted);
      } catch (e: any) {
        console.error("Failed to fetch /purchase_orders/", e);
        if (alive) {
          const msg = e?.response?.status
            ? `Failed to load purchase orders (${e.response.status})`
            : "Failed to load purchase orders. Please try again.";
          setErr(msg);
          setOrders([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const items = o.items ?? [];
      const matchSearch =
        items.some((i) => (i.product_name ?? "").toLowerCase().includes(q));
      const iso = dateOnly(o.created_at);
      const matchStart = startDate ? iso >= startDate : true;
      const matchEnd = endDate ? iso <= endDate : true;
      return matchSearch && matchStart && matchEnd;
    });
  }, [orders, search, startDate, endDate]);

  const computed = useMemo(() => {
    return filtered.map((o) => {
      const items = o.items ?? [];
      const lines = items.length;
      const units = items.reduce((s, i) => s + (i.quantity || 0), 0);
      const itemsTotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_cost || 0), 0);
      const grand = itemsTotal + (o.shipping_cost ?? 0) + (o.handling_cost ?? 0);
      return { ...o, lines, units, itemsTotal, grand };
    });
  }, [filtered]);

  const sorted = useMemo(() => {
    const arr = [...computed];
    arr.sort((a, b) => {
      switch (sortKey) {
        case "lines": return b.lines - a.lines;
        case "units": return b.units - a.units;
        case "grand_total": return b.grand - a.grand;
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return arr;
  }, [computed, sortKey]);

  const totalPages = Math.ceil(sorted.length / perPage) || 1;
  const pageSafe = Math.min(page, totalPages);
  const paged = sorted.slice((pageSafe - 1) * perPage, pageSafe * perPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-sm text-slate-500">All orders on your account.</p>
        </div>
        <button
          onClick={() => nav("/purchase_orders/new")}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + New Purchase Order
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Search (product name)</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Start typing…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
            <input type="date" value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
            <input type="date" value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Sort</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Newest</option>
              <option value="lines">Most lines</option>
              <option value="units">Most units</option>
              <option value="grand_total">Highest total</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setSearch(""); setStartDate(""); setEndDate(""); setSortKey("date"); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>

        {err && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      </div>

      <div className="grid gap-3">
        {loading && (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
            Loading purchase orders…
          </div>
        )}
        {!loading && paged.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
            No purchase orders match your filters.
          </div>
        )}
        {!loading && paged.map((po) => (
          <div key={po.id} className="transition rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-slate-700">🗓 {dateOnly(po.created_at)}</span>
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-amber-700">📦 {po.items?.length ?? 0} lines</span>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">🧮 {money((po.items ?? []).reduce((s, i) => s + (i.quantity || 0) * (i.unit_cost || 0), 0))}</span>
              </div>
              <div className="font-semibold">
                {money(((po.items ?? []).reduce((s, i) => s + (i.quantity || 0) * (i.unit_cost || 0), 0)) + (po.shipping_cost ?? 0) + (po.handling_cost ?? 0))}
              </div>
            </div>

            {po.items && po.items.length > 0 && (
              <div className="mt-3 divide-y rounded-lg border border-slate-200">
                {po.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{(it.product_name ?? `Product #${it.product_id}`)} × {it.quantity}</span>
                    <span className="font-medium">{money((it.quantity || 0) * (it.unit_cost || 0))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1 pt-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={[
                "min-w-[2.25rem] rounded-lg border px-3 py-1 text-sm",
                pageSafe === i + 1 ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white hover:bg-slate-50",
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
