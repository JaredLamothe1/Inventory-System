// src/pages/PurchaseOrderDetails.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/api";

type POItem = {
  id: number;
  product_id: number;
  product_name: string;
  category_name?: string | null;
  quantity: number;
  unit_cost: number;
};
type PurchaseOrder = {
  id: number;
  created_at: string;
  shipping_cost: number;
  handling_cost: number;
  items_subtotal: number;
  grand_total: number;
  items: POItem[];
};

function apiUrl(path: string) {
  const base =
    (api as any)?.defaults?.baseURL ||
    (import.meta.env as any)?.VITE_API_URL ||
    "";
  const clean = String(base).replace(/\/+$/, "");
  return clean ? `${clean}${path}` : path;
}
const money = (n: number) =>
  (n ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const SKIP_KEY = "po.skipDeleteConfirm";

export default function PurchaseOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(
    localStorage.getItem(SKIP_KEY) === "1"
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const { data } = await api.get<PurchaseOrder>(
          apiUrl(`/purchase_orders/${id}`)
        );
        if (alive) setPo(data);
      } catch (e: any) {
        const msg =
          e?.response?.data?.detail ||
          e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch purchase order.";
        if (alive) setErr(String(msg));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const groups = useMemo(() => {
    if (!po)
      return [] as {
        category: string;
        items: POItem[];
        qty: number;
        subtotal: number;
      }[];
    const map = new Map<string, POItem[]>();
    for (const it of po.items) {
      const key = it.category_name || "Uncategorized";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    const out = [...map.entries()].map(([category, items]) => {
      const qty = items.reduce((a, b) => a + (b.quantity || 0), 0);
      const subtotal = items.reduce(
        (a, b) => a + (b.quantity || 0) * (b.unit_cost || 0),
        0
      );
      return { category, items, qty, subtotal };
    });
    out.sort((a, b) => a.category.localeCompare(b.category));
    return out;
  }, [po]);

  async function doDelete() {
    if (!po || deleting) return;
    setDeleting(true);
    const primary = apiUrl(`/purchase_orders/${po.id}`);
    const alternate = apiUrl(`/purchase_orders/${po.id}/`);
    try {
      const res = await api.delete(primary, { validateStatus: () => true });
      if (res.status >= 200 && res.status < 300)
        return nav("/purchase-orders");
      if ([301, 302, 303, 307, 308, 404, 405].includes(res.status)) {
        const res2 = await api.delete(alternate, {
          validateStatus: () => true,
        });
        if (res2.status >= 200 && res2.status < 300)
          return nav("/purchase-orders");
        alert(res2.data?.detail || `Delete failed (HTTP ${res2.status}).`);
      } else {
        alert(res.data?.detail || `Delete failed (HTTP ${res.status}).`);
      }
    } catch (e: any) {
      alert(e?.message || "Network error while deleting.");
    } finally {
      setDeleting(false);
      setShowConfirm(false);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!po) return <div className="p-6">Not found.</div>;

  const sAndH = (po.shipping_cost ?? 0) + (po.handling_cost ?? 0);
  const grand = po.items_subtotal + sAndH;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Purchase Order #{po.id}
          </h1>
          <p className="text-sm text-slate-600">
            Date: {new Date(po.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => nav("/purchase-orders")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            Back
          </button>
          {/* FIX: go to /purchase-orders/:id/edit (was /purchase-orders/edit/:id) */}
          <button
            onClick={() => nav(`/purchase-orders/${po.id}/edit`)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Edit
          </button>
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
              <div className="font-semibold">Delete this purchase order?</div>
              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dontAskAgain}
                  onChange={(e) => setDontAskAgain(e.target.checked)}
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Items</h2>
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.category} className="rounded-xl border border-slate-200">
              <div className="flex items-center justify-between bg-slate-50 px-4 py-2">
                <div className="font-medium">{g.category}</div>
                <div className="text-sm text-slate-600">
                  Qty: <span className="font-medium">{g.qty}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white">
                    <tr className="text-left">
                      <th className="px-4 py-2">Product</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2 text-right">Unit Cost</th>
                      <th className="px-4 py-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="px-4 py-2">{it.product_name}</td>
                        <td className="px-4 py-2 text-right">{it.quantity}</td>
                        <td className="px-4 py-2 text-right">
                          {money(it.unit_cost)}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {money(it.unit_cost * it.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-right" colSpan={3}>
                        Category Subtotal
                      </th>
                      <td className="px-4 py-2 text-right font-semibold">
                        {money(g.subtotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <div className="ml-auto w-full max-w-sm space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Items</span>
              <span className="font-medium">{money(po.items_subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Shipping + Handling</span>
              <span className="font-medium">{money(sAndH)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{money(grand)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
