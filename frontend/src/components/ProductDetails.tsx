// src/pages/ProductDetails.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/api";
import CategoryPicker from "@/components/CategoryPicker";
import { CategoryNode } from "@/components/CategoryTree";

interface Product {
  id: number;
  name: string;
  description?: string | null;
  notes?: string | null;
  category_id?: number | null;
  category_name?: string | null;
  unit_cost?: number | null;
  sale_price?: number | null;
  resolved_price?: number | null;
  quantity_in_stock: number;
  reorder_threshold?: number | null;
}

const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
const normalize = (p: Product): Product => ({
  ...p,
  description: p.description ?? null,
  notes: p.notes ?? null,
  category_id: p.category_id ?? null,
  unit_cost: p.unit_cost ?? null,
  sale_price: p.sale_price ?? null,
  resolved_price: p.resolved_price ?? null,
  reorder_threshold: p.reorder_threshold ?? null,
});

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const pid = Number(id);
  const navigate = useNavigate();
  const [catTree, setCatTree] = useState<CategoryNode[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<Product | null>(null);
  const [overrideSale, setOverrideSale] = useState(false);
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => { api.get<CategoryNode[]>("/categories/tree").then(r => setCatTree(r.data)).catch(() => setCatTree([])); }, []);
  useEffect(() => {
    setLoading(true);
    api.get<Product>(`/products/${pid}`)
      .then(r => { const n = normalize(r.data); setProduct(n); setForm(n); setOverrideSale(n.sale_price != null); })
      .catch(() => setMsg({ text: "Failed to load product.", isError: true }))
      .finally(() => setLoading(false));
  }, [pid]);

  const change = (field: keyof Product, value: any) => setForm(f => (f ? { ...f, [field]: value } : f));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const payload: any = {
      name: form.name,
      description: form.description ?? null,
      notes: form.notes ?? null,
      category_id: form.category_id ?? null,
      unit_cost: num(form.unit_cost),
      quantity_in_stock: form.quantity_in_stock,
      sale_price: overrideSale ? num(form.sale_price) : null,
    };
    try {
      const res = await api.patch<Product>(`/products/${pid}`, payload);
      const n = normalize(res.data);
      setProduct(n); setForm(n); setOverrideSale(n.sale_price != null);
      setMsg({ text: "Saved successfully.", isError: false });
    } catch (err: any) {
      setMsg({ text: err.response?.data?.detail || "Save failed.", isError: true });
    }
  };
  const doDelete = async () => { await api.delete(`/products/${pid}`); navigate("/products"); };

  if (loading || !form) return <div className="p-6 text-center">Loading…</div>;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/products")} className="text-sm text-blue-700 hover:underline">← Back to products</button>

      {msg && (
        <div className={`rounded-lg p-3 text-sm ${msg.isError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.text}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <form onSubmit={save} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h1 className="text-xl font-semibold">Product details</h1>

          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input value={form.name} onChange={e => change("name", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <CategoryPicker tree={catTree} value={form.category_id ?? null} onChange={id => change("category_id", id ?? null)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Unit cost</label>
              <input value={form.unit_cost ?? ""} onChange={e => change("unit_cost", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Stock</label>
              <input type="number" min={0} value={form.quantity_in_stock} onChange={e => change("quantity_in_stock", Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Sale price override</label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={overrideSale} onChange={e => setOverrideSale(e.target.checked)} />
                Enable override
              </label>
              <input
                disabled={!overrideSale}
                value={overrideSale ? (form.sale_price ?? "") : ""}
                onChange={e => change("sale_price", e.target.value)}
                className={`w-40 rounded-lg border px-3 py-2 text-sm focus:outline-none ${overrideSale ? "border-slate-300 focus:ring-2 focus:ring-blue-500" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                placeholder="e.g. 19.99"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea value={form.description ?? ""} onChange={e => change("description", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={4} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Notes</label>
            <textarea value={form.notes ?? ""} onChange={e => change("notes", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => navigate("/products")} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">Save</button>
          </div>
        </form>

        {/* Danger zone */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Danger zone</h2>
          <p className="mt-1 text-sm text-slate-600">Deleting a product cannot be undone.</p>
          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Delete product</button>
          ) : (
            <div className="mt-3 space-y-3 rounded-lg border border-slate-200 p-3">
              <div className="text-sm">Are you sure?</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowDeleteConfirm(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">Cancel</button>
                <button onClick={doDelete} className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700">Delete now</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
