// src/pages/SaleDetails.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

interface Product {
  id: number;
  name: string;
}

interface SaleItem {
  id: number;
  product: Product;
  quantity: number;
  unit_price: number;
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

const money = (value: number) =>
  (value ?? 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });

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

const SKIP_KEY = "sales.skipDeleteConfirm";

export default function SaleDetails() {
  const params = useParams();
  const navigate = useNavigate();
  const saleId = (params as any).saleId ?? (params as any).id;

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(
    localStorage.getItem(SKIP_KEY) === "1"
  );

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (!saleId) {
          setErr("Missing sale id.");
          return;
        }

        const res = await fetch(`${import.meta.env.VITE_API_URL}/sales/${saleId}`, {
          headers: authHeaders(),
        });

        if (!res.ok) throw new Error("Failed to load sale");
        setSale(await res.json());
      } catch (error) {
        setErr(error instanceof Error ? error.message : "Could not load this sale.");
      } finally {
        setLoading(false);
      }
    })();
  }, [saleId]);

  const itemsSubtotal = useMemo(
    () =>
      (sale?.items ?? []).reduce(
        (sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0),
        0
      ),
    [sale]
  );

  const fee = Number(sale?.processing_fee ?? 0);
  const safeFee = Number.isFinite(fee) ? fee : 0;
  const grandTotal = itemsSubtotal + safeFee;

  const doDelete = async () => {
    if (!saleId) return;

    const res = await fetch(`${import.meta.env.VITE_API_URL}/sales/${saleId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (res.ok) navigate("/sales");
    else alert("Failed to delete sale.");
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!sale) return <div className="p-6">Not found.</div>;

  const displayDate = sale.sale_date
    ? prettyYMD(sale.sale_date)
    : new Date(sale.created_at).toLocaleDateString();

  const isCardRelated =
    sale.payment_type === "credit_card" || sale.payment_type === "split";
  const feeWasWaived = isCardRelated && safeFee === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sale Details</h1>
          <div className="mt-1 text-sm text-slate-600">Date: {displayDate}</div>

          {sale.notes && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              📝 {sale.notes}
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-white">
              📦 {formatType(sale.sale_type)}
            </span>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">
              💳 {formatPayment(sale.payment_type)}
            </span>
            {feeWasWaived && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
                Card fee waived
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            to="/sales"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            Back
          </Link>
          <Link
            to={`/sales/edit/${sale.id}`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Edit
          </Link>
          <button
            onClick={() => {
              if (localStorage.getItem(SKIP_KEY) === "1") doDelete();
              else setShowConfirm(true);
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Delete this sale?</div>
              <div className="text-sm text-slate-600">
                This also reverts inventory adjustments.
              </div>
              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dontAskAgain}
                  onChange={(event) => setDontAskAgain(event.target.checked)}
                />
                Don’t ask me again
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (dontAskAgain) localStorage.setItem(SKIP_KEY, "1");
                  setShowConfirm(false);
                  doDelete();
                }}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
              >
                Delete now
              </button>
            </div>
          </div>
        </div>
      )}

      {sale.payment_type === "split" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Cash portion</div>
            <div className="mt-1 text-xl font-semibold">
              {money(Number(sale.cash_amount ?? 0))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Credit-card portion</div>
            <div className="mt-1 text-xl font-semibold">
              {money(Number(sale.credit_card_amount ?? 0))}
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit Price</th>
              <th className="px-4 py-3 text-right">Line Total</th>
            </tr>
          </thead>

          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-4 py-3">{item.product?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right">{item.quantity}</td>
                <td className="px-4 py-3 text-right">{money(item.unit_price)}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {money((item.unit_price || 0) * (item.quantity || 0))}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-right" colSpan={3}>
                Subtotal
              </th>
              <td className="px-4 py-3 text-right">{money(itemsSubtotal)}</td>
            </tr>
            <tr>
              <th className="px-4 py-3 text-right" colSpan={3}>
                Card fee
              </th>
              <td className="px-4 py-3 text-right">
                {feeWasWaived ? "Waived" : money(safeFee)}
              </td>
            </tr>
            <tr>
              <th className="px-4 py-3 text-right text-lg" colSpan={3}>
                Total
              </th>
              <td className="px-4 py-3 text-right text-lg font-semibold">
                {money(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}