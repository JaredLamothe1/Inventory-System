// src/pages/AddSaleForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type PaymentType = "cash" | "venmo" | "check" | "credit_card";

interface Product {
  id: number;
  name?: string | null;
  category_id: number | null;
  resolved_price?: number | string | null;
}
interface Category {
  id: number;
  name: string;
  default_sale_price: number | null;
}
interface SaleItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  name: string;
}
interface ExistingSaleItem {
  product_id: number;
  quantity: number;
  unit_price: number | string;
}
interface MeOut { credit_card_fee_flat: number; }

const toNum = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : Number(v as any);
  return Number.isFinite(n) ? n : 0;
};

export default function AddSaleForm() {
  const { saleId } = useParams();
  const isEditing = Boolean(saleId);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "All">("All");
  const [saleDate, setSaleDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saleType, setSaleType] = useState("individual");
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [creditCardFeeFlat, setCreditCardFeeFlat] = useState<number>(0);
  const navigate = useNavigate();

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const [productRes, categoryRes, meRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/products/?limit=1000&page=0&sort_by=name&order=asc`, { headers: authHeaders() }),
          fetch(`${import.meta.env.VITE_API_URL}/categories/`, { headers: authHeaders() }),
          fetch(`${import.meta.env.VITE_API_URL}/me`, { headers: authHeaders() }),
        ]);
        const productData = await productRes.json();
        const categoryData = await categoryRes.json();
        const meData: MeOut = await meRes.json();

        setProducts(productData?.products ?? []);
        setCategories(categoryData ?? []);
        setCreditCardFeeFlat(toNum(meData?.credit_card_fee_flat ?? 0));
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  // Default date (new sale)
  useEffect(() => {
    if (!isEditing) setSaleDate(new Date().toISOString().split("T")[0]);
  }, [isEditing]);

  // Prefill edit
  useEffect(() => {
    if (!isEditing || !saleId) return;
    const allowed: PaymentType[] = ["cash", "venmo", "check", "credit_card"];
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/sales/${saleId}`, { headers: authHeaders() });
        const data = await res.json();
        const normalized = (data?.sale_date ? String(data.sale_date).split("T")[0] : new Date().toISOString().split("T")[0]);
        setSaleDate(normalized);
        setNotes(data?.notes ?? "");
        setSaleType(data?.sale_type ?? "individual");
        const pt = String(data?.payment_type ?? "cash").toLowerCase();
        setPaymentType((allowed as string[]).includes(pt) ? (pt as PaymentType) : "cash");

        const details: SaleItem[] = (data?.items ?? []).map((it: ExistingSaleItem) => {
          const p = products.find(x => x.id === it.product_id);
          return {
            product_id: it.product_id,
            quantity: toNum(it.quantity),
            unit_price: toNum(it.unit_price),
            name: (p?.name ?? "Unnamed Product").toString(),
          };
        });
        setItems(details);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [isEditing, saleId, products]);

  // Helpers
  const getSalePrice = (categoryId: number | null): number => {
    if (categoryId == null) return 0;
    const cat = categories.find(c => c.id === categoryId);
    return toNum(cat?.default_sale_price ?? 0);
  };
  const displayPriceFor = (p: Product) => {
    const fallback = getSalePrice(p.category_id);
    return p.resolved_price != null ? toNum(p.resolved_price) : fallback;
  };

  // UI handlers
  const addProduct = (p: Product) => {
    if (!p?.id) return;
    if (items.find(i => i.product_id === p.id)) return;
    setItems(prev => [...prev, {
      product_id: p.id,
      name: (p.name ?? "Unnamed Product").toString(),
      quantity: 1,
      unit_price: Math.max(0, displayPriceFor(p)),
    }]);
  };
  const setQty = (productId: number, qty: number) =>
    setItems(prev => prev.map(i => i.product_id === productId ? { ...i, quantity: Math.max(0, qty) } : i));
  const setPrice = (productId: number, value: string) => {
    const num = toNum(value);
    setItems(prev => prev.map(i => i.product_id === productId ? { ...i, unit_price: Math.max(0, parseFloat(num.toFixed(2))) } : i));
  };
  const removeLine = (productId: number) =>
    setItems(prev => prev.filter(i => i.product_id !== productId));

  // Filtering
  const filteredProducts = useMemo(() => {
    const q = (searchTerm || "").toLowerCase();
    return products.filter(p => {
      const name = (p.name ?? "").toString().toLowerCase();
      const inText = q ? name.includes(q) : true;
      if (selectedCategoryId === "All") return inText;
      const catId = Number(selectedCategoryId);
      return inText && Number.isFinite(catId) && p.category_id === catId;
    });
  }, [products, searchTerm, selectedCategoryId]);

  // Totals (+ card fee)
  const subtotal = useMemo(() => items.reduce((s, i) => s + toNum(i.quantity) * toNum(i.unit_price), 0), [items]);
  const cardFee = useMemo(() => (paymentType === "credit_card" ? Math.max(0, toNum(creditCardFeeFlat)) : 0), [paymentType, creditCardFeeFlat]);
  const grandTotal = useMemo(() => subtotal + cardFee, [subtotal, cardFee]);

  // Submit
  const handleSubmit = async () => {
    if (items.length === 0) return alert("Please add at least one product.");
    const payload = {
      sale_date: saleDate || null,
      notes: notes || null,
      sale_type: saleType || "individual",
      payment_type: paymentType,
      items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
    };
    try {
      const url = `${import.meta.env.VITE_API_URL}/sales${isEditing ? `/${saleId}` : ""}`;
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      navigate("/sales");
    } catch (e) {
      alert("There was a problem saving this sale.");
    }
  };

  const disabled = items.length === 0;

  return (
    <div className="space-y-6">
      {/* Title bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isEditing ? "Edit Sale" : "New Sale"}</h1>
          <p className="text-sm text-slate-500">Build a sale by adding products. Clean new look, same behavior.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/sales")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={disabled}
            onClick={handleSubmit}
            className={`rounded-lg px-4 py-2 text-sm text-white ${disabled ? "bg-slate-300" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {isEditing ? "Save Changes" : "Create Sale"}
          </button>
        </div>
      </div>

      {/* Form Card */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: product picker */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="sticky top-[4.5rem] z-10 flex items-center gap-3 border-b border-slate-200 bg-white/80 p-4 backdrop-blur">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search products…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedCategoryId}
              onChange={e => setSelectedCategoryId(e.target.value as any)}
            >
              <option value="All">All categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </header>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredProducts.map(p => (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                className="group text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow"
              >
                <div className="font-medium">{p.name}</div>
                <div className="mt-1 text-sm text-slate-500">Default price: ${displayPriceFor(p).toFixed(2)}</div>
                <div className="mt-3 text-xs text-blue-700 opacity-0 group-hover:opacity-100 transition">Click to add</div>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
                No products match your filter.
              </div>
            )}
          </div>
        </section>

        {/* Right: sale meta + lines */}
        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Sale details</h2>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm text-slate-600">Date</label>
                <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)}
                  className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm text-slate-600">Sale type</label>
                <select value={saleType} onChange={e => setSaleType(e.target.value)}
                  className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="individual">Individual</option>
                  <option value="batch-daily">Batch - Daily</option>
                  <option value="batch-weekly">Batch - Weekly</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm text-slate-600">Payment</label>
                <select value={paymentType} onChange={e => setPaymentType(e.target.value as PaymentType)}
                  className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="cash">Cash</option>
                  <option value="venmo">Venmo</option>
                  <option value="check">Check</option>
                  <option value="credit_card">Credit Card</option>
                </select>
              </div>
              <textarea
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Notes (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold mb-3">Line items</h2>
            <div className="space-y-3">
              {items.map(line => (
                <div key={line.product_id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{line.name}</div>
                    <button onClick={() => removeLine(line.product_id)} className="text-sm text-slate-500 hover:text-red-600">Remove</button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Quantity</label>
                      <input type="number" min={0} value={line.quantity}
                        onChange={e => setQty(line.product_id, Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Unit price</label>
                      <input value={line.unit_price} onChange={e => setPrice(line.product_id, e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex flex-col justify-end text-right text-sm">
                      <div className="text-slate-500">Line total</div>
                      <div className="font-semibold">${(line.quantity * line.unit_price).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {items.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">No items yet.</div>}
            </div>

            <div className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Card fee</span>
                <span className="font-medium">${cardFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
