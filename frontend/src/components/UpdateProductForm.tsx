import React, { useState, useEffect, useRef } from "react";
import api from "@/api";
import CategoryPicker from "@/components/CategoryPicker";
import { CategoryNode } from "@/components/CategoryTree";

type Props = {
  productId: number;
  onSaved?: (updated: any) => void;
};

type CategoryOut = {
  id: number;
  name: string;
  default_sale_price: number | string | null;
  base_purchase_price: number | string | null;
};

type Product = {
  id: number;
  name: string;
  unit_cost: number | null;
  sale_price: number | null;
  resolved_price?: number | null;
  quantity_in_stock: number;
  category_id: number | null;
};

const UpdateProductForm: React.FC<Props> = ({ productId, onSaved }) => {
  const [catTree, setCatTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [unitCost, setUnitCost] = useState<number | "">("");
  const [salePrice, setSalePrice] = useState<number | "">("");
  const [qty, setQty] = useState<number>(0);
  const [overrideSale, setOverrideSale] = useState(false);

  // prevent auto-fill overwrite
  const unitDirty = useRef(false);
  const saleDirty = useRef(false);

  /* ------------ initial load ------------ */
  useEffect(() => {
    const load = async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          api.get("/categories/tree"),
          api.get(`/products/${productId}`),
        ]);
        setCatTree(catRes.data);

        const p: Product = prodRes.data;
        setName(p.name);
        setCategoryId(p.category_id);
        setUnitCost(p.unit_cost ?? "");
        setSalePrice(p.sale_price ?? "");
        setQty(p.quantity_in_stock);
        setOverrideSale(p.sale_price != null);
      } catch (err: any) {
        console.error(err);
        setMsg(err?.response?.data?.detail ?? "Failed to load product.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [productId]);

  /* ----- auto-fill prices on category change ----- */
  useEffect(() => {
    if (categoryId == null) return;
    api
      .get<CategoryOut>(`/categories/${categoryId}`)
      .then((res) => {
        const cat = res.data;
        const base = cat.base_purchase_price != null ? Number(cat.base_purchase_price) : "";
        const sale = cat.default_sale_price != null ? Number(cat.default_sale_price) : "";

        if (!unitDirty.current) setUnitCost(base);
        if (!saleDirty.current && !overrideSale) setSalePrice(sale);
      })
      .catch(() => setMsg("Could not load category pricing."));
  }, [categoryId, overrideSale]);

  /* ------------ submit ------------ */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const payload: any = {
      name,
      category_id: categoryId,
      unit_cost: unitCost === "" ? null : Number(unitCost),
      quantity_in_stock: qty,
      sale_price: overrideSale ? (salePrice === "" ? null : Number(salePrice)) : null,
    };

    try {
      const res = await api.patch(`/products/${productId}`, payload);
      setMsg("Saved!");
      onSaved?.(res.data);
    } catch (err: any) {
      console.error(err);
      setMsg(err?.response?.data?.detail ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading…</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {msg && (
        <p className={`text-sm ${msg.includes("fail") ? "text-red-600" : "text-green-600"}`}>
          {msg}
        </p>
      )}

      {/* Name */}
      <div>
        <label className="block mb-1 font-medium">Product name</label>
        <input
          type="text"
          className="w-full p-2 border rounded"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {/* Category */}
      <div>
        <label className="block mb-1 font-medium">Category (optional)</label>
        <CategoryPicker
          tree={catTree}
          value={categoryId}
          onChange={(id) => {
            unitDirty.current = false;
            saleDirty.current = false;
            setCategoryId(id);
          }}
        />
      </div>

      {/* Cost & qty */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block mb-1 font-medium">Unit cost (what you pay)</label>
          <input
            type="number"
            step="0.01"
            className="w-full p-2 border rounded"
            value={unitCost}
            onChange={(e) => {
              unitDirty.current = true;
              setUnitCost(e.target.value === "" ? "" : Number(e.target.value));
            }}
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Quantity in stock</label>
          <input
            type="number"
            className="w-full p-2 border rounded"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Sale override */}
      <div className="flex items-center gap-2">
        <input
          id="overrideSale"
          type="checkbox"
          checked={overrideSale}
          onChange={(e) => {
            setOverrideSale(e.target.checked);
            if (!e.target.checked) {
              saleDirty.current = false;
              setSalePrice("");
            }
          }}
        />
        <label htmlFor="overrideSale">Override category sale price</label>
      </div>

      {overrideSale && (
        <div>
          <label className="block mb-1 font-medium">Sale price (what you charge)</label>
          <input
            type="number"
            step="0.01"
            className="w-full p-2 border rounded"
            value={salePrice}
            onChange={(e) => {
              saleDirty.current = true;
              setSalePrice(e.target.value === "" ? "" : Number(e.target.value));
            }}
            placeholder="0.00"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
};

export default UpdateProductForm;
