// src/pages/SalesPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api"; // use the shared axios instance (baseURL + token)

interface Product { id: number; name: string; }
interface SaleItem { id: number; quantity: number; unit_price: number; product?: Product | null; }
interface Sale {
  id: number;
  created_at: string;
  sale_date?: string | null;
  sale_type?: string | null;
  payment_type?: string | null;
  processing_fee?: number | null;
  notes?: string | null;
  items?: SaleItem[] | null;
}

const formatType = (t?: string | null) =>
  (t ?? "individual")
    .replace("batch-daily", "Batch - Daily")
    .replace("batch-weekly", "Batch - Weekly")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatPayment = (pt?: string | null) =>
  (pt ?? "cash")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Build a URL against api.defaults.baseURL, with VITE_API_URL as fallback */
function apiUrl(path: string) {
  const base =
    (api as any)?.defaults?.baseURL ||
    (import.meta as any)?.env?.VITE_API_URL ||
    "";
  const clean = String(base).replace(/\/+$/, "");
  return clean ? `${clean}${path}` : path;
}

export default function SalesPage() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // Use shared API client (injects Authorization + baseURL)
        const { data } = await api.get<Sale[]>(apiUrl("/sales/"));
        const arr = Array.isArray(data) ? data : [];
        // Sort by (sale_date || created_at) desc
        const sorted = arr.sort(
          (a, b) =>
            new Date((b.sale_date ?? b.created_at) || b.created_at).getTime() -
            new Date((a.sale_date ?? a.created_at) || a.created_at).getTime()
        );
        if (alive) setSales(sorted);
      } catch (e: any) {
        console.error("Failed to fetch /sales/", e);
        if (alive) {
          const msg =
            e?.response?.status
              ? `Failed to load sales (${e.response.status})`
              : "Failed to load sales. Please try again.";
          setErr(msg);
          setSales([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      const items = s.items ?? [];
      const matchSearch =
        (s.notes?.toLowerCase().includes(q) ?? false) ||
        items.some((i) => (i.product?.name ?? "").toLowerCase().includes(q));

      const matchType = typeFilter ? s.sale_type === typeFilter : true;
      const matchPayment = paymentFilter
        ? (s.payment_type ?? "cash") === paymentFilter
        : true;

      const iso = new Date((s.sale_date ?? s.created_at) || s.created_at)
        .toISOString()
        .split("T")[0];
      const matchStart = startDate ? iso >= startDate : true;
      const matchEnd = endDate ? iso <= endDate : true;

      return matchSearch && matchType && matchPayment && matchStart && matchEnd;
    });
  }, [sales, search, typeFilter, paymentFilter, startDate, endDate]);

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * perPage, pageSafe * perPage);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-sm text-slate-500">
            Quick filters + expandable rows. Card fee is included in details.
          </p>
        </div>
        <Link
          to="/sales/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + New Sale
        </Link>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Search
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search notes or products"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Sale Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="individual">Individual</option>
              <option value="batch-daily">Daily Summary</option>
              <option value="batch-weekly">Weekly Summary</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Payment
            </label>
            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="cash">Cash</option>
              <option value="venmo">Venmo</option>
              <option value="check">Check</option>
              <option value="credit_card">Credit Card</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearch("");
                setTypeFilter("");
                setPaymentFilter("");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Error banner */}
        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}
      </div>

      {/* List */}
      <div className="grid gap-3">
        {loading && (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
            Loading sales…
          </div>
        )}
        {!loading && paged.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
            No sales match your filters.
          </div>
        )}
        {!loading &&
          paged.map((sale) => {
            const items = sale.items ?? [];
            const itemsTotal = items.reduce(
              (sum, i) => sum + i.quantity * i.unit_price,
              0
            );
            const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
            const dt = new Date(
              (sale.sale_date ?? sale.created_at) || sale.created_at
            ).toLocaleDateString();
            const notePreview = sale.notes
              ? sale.notes.split(" ").slice(0, 8).join(" ") +
                (sale.notes.split(" ").length > 8 ? "…" : "")
              : "";
            return (
              <div
                key={sale.id}
                className="transition rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                      🗓 {dt}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                      📦 {formatType(sale.sale_type)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-1 text-violet-700">
                      💳 {formatPayment(sale.payment_type)}
                    </span>
                  </div>
                  <div className="font-semibold">${itemsTotal.toFixed(2)}</div>
                </div>

                {sale.notes && (
                  <div className="mt-2 text-sm text-slate-700">
                    📝 {notePreview}
                  </div>
                )}

                {expanded === sale.id && (
                  <div className="mt-3 divide-y rounded-lg border border-slate-200">
                    {items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <span>
                          {(it.product?.name ?? "Item")} × {it.quantity}
                        </span>
                        <span className="font-medium">
                          ${(it.quantity * it.unit_price).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={() =>
                      setExpanded((prev) => (prev === sale.id ? null : sale.id))
                    }
                    className="text-sm text-slate-500 hover:text-blue-700"
                  >
                    {expanded === sale.id
                      ? "Hide Items"
                      : `Show Items (${itemCount})`}
                  </button>
                  <Link
                    to={`/sales/${sale.id}`}
                    className="text-sm font-medium text-blue-700 hover:underline"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            );
          })}
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
                pageSafe === i + 1
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-300 bg-white hover:bg-slate-50",
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
