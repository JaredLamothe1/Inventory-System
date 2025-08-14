import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/api";
import { Trash2 } from "lucide-react";
import CategoryPicker from "@/components/CategoryPicker";
import { CategoryNode } from "@/components/CategoryTree";

/* ---------- Types ---------- */
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

/* ---------- Helpers ---------- */
const num = (v: unknown) => (v == null || v === "" ? null : Number(v));

const fmtMoney = (v: unknown) => {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && !isNaN(Number(v))
      ? Number(v)
      : NaN;
  return !isNaN(n) ? `$${n.toFixed(2)}` : "—";
};

// Normalize undefined → null for all nullable fields
const normalizeProduct = (p: Product): Product => ({
  ...p,
  description: p.description ?? null,
  notes: p.notes ?? null,
  category_id: p.category_id ?? null,
  unit_cost: p.unit_cost ?? null,
  sale_price: p.sale_price ?? null,
  resolved_price: p.resolved_price ?? null,
  reorder_threshold: p.reorder_threshold ?? null,
});

/* ---------- Component ---------- */
export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const pid = Number(id);
  const navigate = useNavigate();

  // Categories for picker
  const [catTree, setCatTree] = useState<CategoryNode[]>([]);

  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<Product | null>(null);
  const [overrideSale, setOverrideSale] = useState(false);
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  /* Load categories */
  useEffect(() => {
    api
      .get<CategoryNode[]>("/categories/tree")
      .then((r) => setCatTree(r.data))
      .catch(() => setCatTree([]));
  }, []);

  /* Load product */
  useEffect(() => {
    setLoading(true);
    api
      .get<Product>(`/products/${pid}`)
      .then((r) => {
        const normalized = normalizeProduct(r.data);
        setProduct(normalized);
        setForm(normalized);
        setOverrideSale(normalized.sale_price != null);
      })
      .catch(() => setMsg({ text: "Failed to load product.", isError: true }))
      .finally(() => setLoading(false));
  }, [pid]);

  /* Handlers */
  const handleChange = (field: keyof Product, value: any) => {
    setForm((f) => (f ? { ...f, [field]: value } : f));
  };

  const handleSave = async (e: React.FormEvent) => {
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
      const normalized = normalizeProduct(res.data);
      setProduct(normalized);
      setForm(normalized);
      setOverrideSale(normalized.sale_price != null);
      setMsg({ text: "Saved successfully.", isError: false });
    } catch (err: any) {
      setMsg({ text: err.response?.data?.detail || "Save failed.", isError: true });
    }
  };

  const handleDelete = async () => {
    await api.delete(`/products/${pid}`);
    navigate("/products");
  };

  if (loading || !form) {
    return <div className="p-6 text-center">Loading…</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto bg-white rounded-lg shadow">
      {/* Back link */}
      <button
        onClick={() => navigate("/products")}
        className="text-blue-600 hover:underline mb-4 text-sm"
      >
        ← Back to products
      </button>

      {msg && (
        <div
          className={`mb-4 p-3 rounded text-sm ${
            msg.isError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Main form */}
        <form onSubmit={handleSave} className="space-y-6 lg:col-span-2">
          {/* Product details */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Product details</h2>

            <div>
              <label className="block mb-1 font-medium">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full border rounded p-2"
                required
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Category</label>
              <CategoryPicker
                tree={catTree}
                value={form.category_id ?? null}
                onChange={(id) => handleChange("category_id", id ?? null)}
              />
            </div>
          </section>

          {/* Content */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Content</h2>

            <div>
              <label className="block mb-1 font-medium">Description</label>
              <textarea
                value={form.description ?? ""}
                onChange={(e) => handleChange("description", e.target.value)}
                className="w-full border rounded p-2 h-32"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Notes</label>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => handleChange("notes", e.target.value)}
                className="w-full border rounded p-2 h-24"
              />
            </div>
          </section>

          {/* Submit lives here so Enter works and we avoid onClick casts */}
          <div className="hidden">
            <button type="submit">Save</button>
          </div>
        </form>

        {/* Right: Sidebar */}
        <aside className="space-y-6">
          {/* Pricing & inventory */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Pricing & inventory</h2>

            <div>
              <label className="block mb-1 font-medium">Purchase cost</label>
              <input
                type="number"
                step="0.01"
                value={form.unit_cost ?? ""}
                onChange={(e) => handleChange("unit_cost", num(e.target.value))}
                className="w-full border rounded p-2"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Quantity in stock</label>
              <input
                type="number"
                value={form.quantity_in_stock}
                onChange={(e) =>
                  handleChange("quantity_in_stock", Number(e.target.value))
                }
                className="w-full border rounded p-2"
              />
            </div>

            <div>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={overrideSale}
                  onChange={(e) => setOverrideSale(e.target.checked)}
                  className="form-checkbox"
                />
                <span className="font-medium">Override sale price</span>
              </label>
              {overrideSale && (
                <input
                  type="number"
                  step="0.01"
                  value={form.sale_price ?? ""}
                  onChange={(e) => handleChange("sale_price", num(e.target.value))}
                  className="w-full border rounded p-2 mt-1"
                />
              )}
            </div>
          </section>

          {/* Computed */}
          <section className="space-y-2 text-sm text-gray-700">
            <div>
              <strong>Effective sale price:</strong> {fmtMoney(form.resolved_price ?? null)}
            </div>
            <div>
              <strong>Total inventory value:</strong>{" "}
              {form.unit_cost != null
                ? fmtMoney((form.unit_cost as number) * form.quantity_in_stock)
                : "—"}
            </div>
          </section>

          {/* Actions */}
          <section className="space-y-2">
            <button
              type="button"
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4" /> Delete product
            </button>

            <button
              type="submit"
              form="__product_form__"
              className="hidden"
            />
            <button
              onClick={(e) => handleSave(e)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save changes
            </button>
          </section>

          {showDeleteConfirm && (
            <div className="p-4 bg-red-50 rounded border border-red-200">
              <p className="mb-3 font-semibold text-red-800">
                Are you sure you want to delete this product?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
