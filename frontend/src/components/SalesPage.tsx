// src/pages/SalesPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

interface Product {
  id: number;
  name: string;
}

interface SaleItem {
  id: number;
  quantity: number;
  unit_price: number;
  product: Product;
}

interface Sale {
  id: number;
  created_at: string;
  sale_date?: string;
  sale_type?: string;
  payment_type?: string;
  processing_fee?: number;
  apply_processing_fee?: boolean;
  cash_amount?: number;
  credit_card_amount?: number;
  notes?: string;
  items: SaleItem[];
}

const formatType = (type?: string) =>
  (type ?? "individual")
    .replace("batch-daily", "Batch - Daily")
    .replace("batch-weekly", "Batch - Weekly")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const formatPayment = (payment?: string) =>
  (payment ?? "cash")
    .replace("split", "Split: Cash + Card")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const prettyYMD = (ymd: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [year, month, day] = ymd.split("-");
  return `${Number(month)}/${Number(day)}/${year}`;
};

const dayKey = (sale: Sale) => sale.sale_date ?? sale.created_at.slice(0, 10);

const displayDate = (sale: Sale) =>
  sale.sale_date
    ? prettyYMD(sale.sale_date)
    : new Date(sale.created_at).toLocaleDateString();

export default function SalesPage() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sales/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;
      const data: Sale[] = await res.json();
      setSales([...data].sort((a, b) => dayKey(b).localeCompare(dayKey(a))));
    })();
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();

    return sales.filter((sale) => {
      const items = sale.items ?? [];
      const matchesSearch =
        (sale.notes?.toLowerCase().includes(query) ?? false) ||
        items.some((item) => item.product?.name?.toLowerCase().includes(query));

      const matchesType = typeFilter ? sale.sale_type === typeFilter : true;
      const matchesPayment = paymentFilter
        ? (sale.payment_type ?? "cash") === paymentFilter
        : true;

      const key = dayKey(sale);
      const matchesStart = startDate ? key >= startDate : true;
      const matchesEnd = endDate ? key <= endDate : true;

      return matchesSearch && matchesType && matchesPayment && matchesStart && matchesEnd;
    });
  }, [sales, search, typeFilter, paymentFilter, startDate, endDate]);

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("");
    setPaymentFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-sm text-slate-500">Search, filter, and review transactions.</p>
        </div>
        <Link
          to="/sales/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + New Sale
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Search</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search notes or products"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Sale Type</label>
            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
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
            <label className="mb-1 block text-xs font-medium text-slate-600">Payment</label>
            <select
              value={paymentFilter}
              onChange={(event) => {
                setPaymentFilter(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="cash">Cash</option>
              <option value="venmo">Venmo</option>
              <option value="check">Check</option>
              <option value="credit_card">Credit Card</option>
              <option value="split">Split: Cash + Card</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {paged.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
            No sales match your filters.
          </div>
        )}

        {paged.map((sale) => {
          const subtotal = sale.items.reduce(
            (sum, item) => sum + item.quantity * item.unit_price,
            0
          );
          const fee = Number(sale.processing_fee ?? 0);
          const total = subtotal + (Number.isFinite(fee) ? fee : 0);
          const itemCount = sale.items.reduce((sum, item) => sum + item.quantity, 0);
          const notePreview = sale.notes
            ? `${sale.notes.split(" ").slice(0, 8).join(" ")}${
                sale.notes.split(" ").length > 8 ? "…" : ""
              }`
            : "";

          return (
            <div
              key={sale.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center justify-between text-sm text-slate-500">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                    🗓 {displayDate(sale)}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                    📦 {formatType(sale.sale_type)}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-1 text-violet-700">
                    💳 {formatPayment(sale.payment_type)}
                  </span>
                  {(sale.payment_type === "credit_card" || sale.payment_type === "split") && fee === 0 && (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                      Fee waived
                    </span>
                  )}
                </div>
                <div className="font-semibold text-slate-800">${total.toFixed(2)}</div>
              </div>

              {sale.payment_type === "split" && (
                <div className="mt-2 text-xs text-slate-500">
                  Cash: ${Number(sale.cash_amount ?? 0).toFixed(2)} · Card: ${Number(
                    sale.credit_card_amount ?? 0
                  ).toFixed(2)}
                </div>
              )}

              {sale.notes && <div className="mt-2 text-sm text-slate-700">📝 {notePreview}</div>}

              {expanded === sale.id && (
                <div className="mt-3 divide-y rounded-lg border border-slate-200">
                  {sale.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span>
                        {item.product?.name} × {item.quantity}
                      </span>
                      <span className="font-medium">
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </span>
                    </div>
                  ))}

                  {fee > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>Credit-card fee</span>
                      <span className="font-medium">${fee.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={() =>
                    setExpanded((previous) => (previous === sale.id ? null : sale.id))
                  }
                  className="text-sm text-slate-500 hover:text-blue-700"
                >
                  {expanded === sale.id ? "Hide Items" : `Show Items (${itemCount})`}
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

      {totalPages > 1 && (
        <div className="flex justify-center gap-1 pt-2">
          {Array.from({ length: totalPages }, (_, index) => (
            <button
              key={index}
              onClick={() => setPage(index + 1)}
              className={[
                "min-w-[2.25rem] rounded-lg border px-3 py-1 text-sm",
                safePage === index + 1
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-300 bg-white hover:bg-slate-50",
              ].join(" ")}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}