// src/pages/SaleDetails.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";

interface Product { id: number; name: string; }
interface SaleItem { id: number; product: Product; quantity: number; unit_price: number; }
interface Sale {
  id: number;
  created_at: string;
  sale_date?: string;
  sale_type?: string;
  payment_type?: string;
  processing_fee?: number;
  notes?: string;
  items: SaleItem[];
}

const money = (n: number) => (n ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const formatType = (t?: string) => (t ?? "individual").replace("batch-daily","Batch - Daily").replace("batch-weekly","Batch - Weekly").replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const formatPayment = (pt?: string) => (pt ?? "cash").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const SKIP_KEY = "sales.skipDeleteConfirm";

export default function SaleDetails() {
  const params = useParams();
  const navigate = useNavigate();
  const saleId = (params as any).saleId ?? (params as any).id;

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(localStorage.getItem(SKIP_KEY) === "1");

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setErr(null);
        if (!saleId) { setErr("Missing sale id."); return; }
        const res = await fetch(`${import.meta.env.VITE_API_URL}/sales/${saleId}`, { headers: authHeaders() });
        if (!res.ok) throw new Error("Failed to load sale");
        setSale(await res.json());
      } catch (e: any) {
        setErr(e?.message || "Could not load this sale.");
      } finally { setLoading(false); }
    })();
  }, [saleId]);

  const itemsSubtotal = useMemo(
    () => (sale?.items ?? []).reduce((s, it) => s + (it.quantity || 0) * (it.unit_price || 0), 0),
    [sale]
  );
  const fee = Number(sale?.processing_fee ?? 0);
  const showFee = fee > 0;
  const grandTotal = itemsSubtotal + (Number.isFinite(fee) ? fee : 0);

  const doDelete = async () => {
    if (!saleId) return;
    const res = await fetch(`${import.meta.env.VITE_API_URL}/sales/${saleId}`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) { navigate("/sales"); } else { alert("Failed to delete sale."); }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!sale) return <div className="p-6">Not found.</div>;

  const displayDate = new Date(sale.sale_date ?? sale.created_at).toLocaleDateString();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sale Details</h1>
          <div className="mt-1 text-sm text-slate-600">Date: {displayDate}</div>
          {sale.notes && <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 border border-slate-200">📝 {sale.notes}</div>}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-800 text-white px-2.5 py-1">📦 {formatType(sale.sale_type)}</span>
            <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-1">💳 {formatPayment(sale.payment_type)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/sales" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Back</Link>
          <Link to={`/sales/edit/${sale.id}`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">Edit</Link>
          <button
            onClick={() => {
              if (localStorage.getItem(SKIP_KEY) === "1") { doDelete(); }
              else { setShowConfirm(true); }
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
              <div className="text-sm text-slate-600">This also reverts inventory adjustments.</div>
              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={dontAskAgain} onChange={e => setDontAskAgain(e.target.checked)} />
                Don’t ask me again
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => { if (dontAskAgain) localStorage.setItem(SKIP_KEY, "1"); setShowConfirm(false); doDelete(); }}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
              >
                Delete now
              </button>
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
            {sale.items.map(it => (
              <tr key={it.id} className="border-t">
                <td className="px-4 py-3">{it.product?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right">{it.quantity}</td>
                <td className="px-4 py-3 text-right">{money(it.unit_price)}</td>
                <td className="px-4 py-3 text-right font-medium">{money((it.unit_price || 0) * (it.quantity || 0))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-right" colSpan={3}>Subtotal</th>
              <td className="px-4 py-3 text-right">{money(itemsSubtotal)}</td>
            </tr>
            <tr>
              <th className="px-4 py-3 text-right" colSpan={3}>Card fee</th>
              <td className="px-4 py-3 text-right">{showFee ? money(fee) : money(0)}</td>
            </tr>
            <tr>
              <th className="px-4 py-3 text-right text-lg" colSpan={3}>Total</th>
              <td className="px-4 py-3 text-right text-lg font-semibold">{money(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
