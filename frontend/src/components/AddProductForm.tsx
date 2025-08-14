import React, { useState, useEffect, useRef } from "react";
import api from "@/api";
import CategoryPicker from "@/components/CategoryPicker";
import { CategoryNode } from "@/components/CategoryTree";

interface AddProductFormProps {
  closeForm?: () => void;
  catTree: CategoryNode[];
}

type CategoryOut = {
  id: number;
  name: string;
  default_sale_price: number | string | null;
  base_purchase_price: number | string | null;
  purchase_tiers: any[];
};

const AddProductForm: React.FC<AddProductFormProps> = ({ closeForm, catTree }) => {
  const [name, setName] = useState("");
  const [unitCost, setUnitCost] = useState<number | "">("");
  const [salePrice, setSalePrice] = useState<number | "">("");
  const [quantityInStock, setQuantityInStock] = useState<number>(0);
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [loadingCat, setLoadingCat] = useState(false);

  // Track if user has manually edited fields so we don't clobber them on category change
  const unitCostDirty = useRef(false);
  const salePriceDirty = useRef(false);

  /* ------------ Auto-fill on category change ------------ */
  useEffect(() => {
    if (categoryId == null) return;
    setLoadingCat(true);
    api
      .get<CategoryOut>(`/categories/${categoryId}`)
      .then((res) => {
        const cat = res.data;
        const base = cat.base_purchase_price != null ? Number(cat.base_purchase_price) : "";
        const sale = cat.default_sale_price != null ? Number(cat.default_sale_price) : "";

        if (!unitCostDirty.current) setUnitCost(base);
        if (!salePriceDirty.current) setSalePrice(sale);
      })
      .catch((err) => {
        console.error("Failed to load category", err);
        setMessage("Could not load category pricing.");
      })
      .finally(() => setLoadingCat(false));
  }, [categoryId]);

  /* ------------ Handlers ------------ */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name,
      unit_cost: unitCost === "" ? null : Number(unitCost),
      sale_price: salePrice === "" ? null : Number(salePrice),
      quantity_in_stock: quantityInStock,
      category_id: categoryId,
      // hidden fields we’re not using now
      reorder_threshold: 0,
      restock_target: 0,
      storage_space: null,
      collection_ids: [], // we’ll hook collections in later
    };

    try {
      await api.post("/products/", payload);
      setMessage("Product added!");
      closeForm?.();
    } catch (err: any) {
      console.error("Error creating product:", err);
      setMessage(err?.response?.data?.detail ?? "There was an error. Please try again.");
    }
  };

  const onUnitCostChange = (v: string) => {
    unitCostDirty.current = true;
    setUnitCost(v === "" ? "" : Number(v));
  };

  const onSalePriceChange = (v: string) => {
    salePriceDirty.current = true;
    setSalePrice(v === "" ? "" : Number(v));
  };

  /* ------------ Render ------------ */
  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {message && (
        <p className={`text-center text-sm ${message.includes("error") ? "text-red-600" : "text-green-600"}`}>
          {message}
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
        <CategoryPicker tree={catTree} value={categoryId} onChange={(id) => {
          // reset dirty flags when switching category
          unitCostDirty.current = false;
          salePriceDirty.current = false;
          setCategoryId(id);
        }} />
        {loadingCat && <p className="text-xs text-gray-500 mt-1">Loading category prices…</p>}
      </div>

      {/* Pricing + Qty */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block mb-1 font-medium">Unit cost (what you pay)</label>
          <input
            type="number"
            step="0.01"
            className="w-full p-2 border rounded"
            value={unitCost}
            onChange={(e) => onUnitCostChange(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Sale price (what you charge)</label>
          <input
            type="number"
            step="0.01"
            className="w-full p-2 border rounded"
            value={salePrice}
            onChange={(e) => onSalePriceChange(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <label className="block mb-1 font-medium">Quantity in stock</label>
        <input
          type="number"
          className="w-full p-2 border rounded"
          value={quantityInStock}
          onChange={(e) => setQuantityInStock(Number(e.target.value))}
          required
        />
      </div>

      <button
        type="submit"
        className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Add Product
      </button>
    </form>
  );
};

export default AddProductForm;
