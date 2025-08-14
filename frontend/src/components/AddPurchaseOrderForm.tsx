import React, { useState, useEffect } from "react";
import api from "@/api";
import { useNavigate } from "react-router-dom";

/* -------- Types -------- */
interface Product {
  id: number;
  name: string;
  category_id: number;
}

interface PurchaseTier {
  threshold: number;
  price: number;
}

interface Category {
  id: number;
  name: string;
  base_purchase_price: number;       // always a number
  purchase_tiers: PurchaseTier[];    // thresholds & prices always numbers
}

/* -------- Component -------- */
export default function AddPurchaseOrderForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [orderItems, setOrderItems] = useState<Record<number, number>>({});
  const [categoryQuantities, setCategoryQuantities] = useState<Record<number, number>>({});
  const [orderDate, setOrderDate] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigate = useNavigate();

  // Fetch products + categories
  useEffect(() => {
    api
      .get("/products/", { params: { page: 0, limit: 1000, sort_by: "name", order: "asc" } })
      .then((res) => setProducts(res.data.products || []))
      .catch(() => setProducts([]));

    api
      .get("/categories/")
      .then((res) => {
        const cats: Category[] = res.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          base_purchase_price: Number(c.base_purchase_price) || 0,
          purchase_tiers: (c.purchase_tiers || []).map((t: any) => ({
            threshold: Number(t.threshold),
            price: Number(t.price),
          })),
        }));
        setCategories(cats);
        if (cats.length) setSelectedCategoryId(cats[0].id);
      })
      .catch(() => setCategories([]));
  }, []);

  // Update quantities and per-category totals
  function updateQuantity(productId: number, qty: number) {
    setOrderItems((prev) => {
      const updated = { ...prev, [productId]: qty };
      const totals: Record<number, number> = {};
      products.forEach((p) => {
        const q = updated[p.id] || 0;
        totals[p.category_id] = (totals[p.category_id] || 0) + q;
      });
      setCategoryQuantities(totals);
      return updated;
    });
  }

  // Determine unit price based on category's tiers or base price
  function getCategoryUnitPrice(catId: number): number {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return 0;
    const qty = categoryQuantities[catId] || 0;
    let price = cat.base_purchase_price;
    cat.purchase_tiers
      .sort((a, b) => a.threshold - b.threshold)
      .forEach((tier) => {
        if (qty >= tier.threshold) {
          price = tier.price;
        }
      });
    return price;
  }

  // Next tier info
  function getNextTierInfo(catId: number) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return null;
    const qty = categoryQuantities[catId] || 0;
    const sorted = [...cat.purchase_tiers].sort((a, b) => a.threshold - b.threshold);
    for (const tier of sorted) {
      if (qty < tier.threshold) {
        return {
          needed: tier.threshold - qty,
          nextPrice: tier.price,
          nextQty: tier.threshold,
        };
      }
    }
    return null;
  }

  // Filter visible products
  const visibleProducts = selectedCategoryId == null
    ? products
    : products.filter((p) => p.category_id === selectedCategoryId);

  // Compute total cost
  const totalCost = Object.entries(orderItems).reduce((sum, [idStr, qty]) => {
    const id = Number(idStr);
    const prod = products.find((p) => p.id === id);
    if (!prod) return sum;
    return sum + getCategoryUnitPrice(prod.category_id) * qty;
  }, 0);

  // Submit handler
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = Object.entries(orderItems)
      .filter(([, qty]) => qty > 0)
      .map(([idStr, qty]) => {
        const prodId = Number(idStr);
        const prod = products.find((p) => p.id === prodId)!;
        return {
          product_id: prodId,
          quantity: qty,
          unit_cost: getCategoryUnitPrice(prod.category_id),
        };
      });

    if (!orderDate || items.length === 0) {
      setErrorMessage("Please select a date and add at least one item.");
      return;
    }

    api
      .post("/purchase_orders/", { created_at: orderDate, items })
      .then(() => navigate("/purchase-orders"))
      .catch(() => setErrorMessage("Failed to create purchase order."));
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Create Purchase Order</h2>

      {errorMessage && (
        <div className="text-red-600 bg-red-100 p-3 rounded mb-4">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium mb-1">Order Date</label>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="border p-2 w-full rounded"
            required
          />
        </div>

        {/* Category selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-4 py-2 rounded ${
                selectedCategoryId === cat.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Unit price & tier info */}
        {selectedCategoryId != null && (
          <div className="mb-4">
            <p className="font-semibold text-lg">
              💰 Unit price:{" "}
              <strong>${getCategoryUnitPrice(selectedCategoryId).toFixed(2)}</strong>
            </p>
            {getNextTierInfo(selectedCategoryId) && (
              <p className="text-sm text-gray-600">
                📈 {categoryQuantities[selectedCategoryId] || 0}/
                {getNextTierInfo(selectedCategoryId)!.nextQty} units —{" "}
                {getNextTierInfo(selectedCategoryId)!.needed} more to reach $
                {getNextTierInfo(selectedCategoryId)!.nextPrice.toFixed(2)}/unit
              </p>
            )}
          </div>
        )}

        {/* Products table */}
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="border px-4 py-2 text-left">Product</th>
                <th className="border px-4 py-2 text-left">Quantity</th>
                <th className="border px-4 py-2 text-left">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((prod) => {
                const qty = orderItems[prod.id] || 0;
                const unit = getCategoryUnitPrice(prod.category_id);
                return (
                  <tr key={prod.id}>
                    <td className="border px-4 py-2">{prod.name}</td>
                    <td className="border px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        value={qty}
                        onChange={(e) =>
                          updateQuantity(prod.id, Number(e.target.value))
                        }
                        className="p-1 border rounded w-20"
                      />
                    </td>
                    <td className="border px-4 py-2">
                      ${ (unit * qty).toFixed(2) }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="text-right text-lg font-semibold pt-4">
          Total: ${totalCost.toFixed(2)}
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-4 mt-6">
          <button
            type="button"
            onClick={() => navigate("/purchase-orders")}
            className="w-1/2 bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Submit Purchase Order
          </button>
        </div>
      </form>
    </div>
  );
}
