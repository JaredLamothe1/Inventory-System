// src/pages/AddPurchaseOrderForm.tsx
import React, { useState, useEffect, useMemo } from "react";
import api from "@/api";
import { useNavigate, useParams } from "react-router-dom";

function apiUrl(path: string) {
  const base =
    (api as any)?.defaults?.baseURL ||
    (import.meta.env as any)?.VITE_API_URL ||
    "";
  const clean = String(base).replace(/\/+$/, "");
  return clean ? `${clean}${path}` : path;
}

interface Product { id: number; name: string; category_id: number; }
interface PurchaseTier { threshold: number; price: number; }
interface Category {
  id: number;
  name: string;
  base_purchase_price: number;
  purchase_tiers: PurchaseTier[];
}
interface PurchaseOrderItemDTO {
  product_id: number;
  quantity: number;
  unit_cost: number;
  product?: { id: number; name: string; category?: { id: number } };
}
interface PurchaseOrderDTO {
  id: number;
  created_at: string;
  shipping_cost?: number;
  handling_cost?: number;
  items: PurchaseOrderItemDTO[];
}

const money = (n: number) =>
  (n ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function AddPurchaseOrderForm() {
  const params = useParams();
  const routeId = (params as any).id ? String((params as any).id) : undefined;
  const isEdit = Boolean(routeId);
  const navigate = useNavigate();

  const [poId, setPoId] = useState<string | null>(routeId ?? null); // <-- used by Cancel
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // product_id -> qty (numeric)
  const [orderItems, setOrderItems] = useState<Record<number, number>>({});
  // product_id -> current text in Qty input (to allow "" while focused)
  const [qtyDrafts, setQtyDrafts] = useState<Record<number, string>>({});
  // product_id -> unit override string
  const [overrides, setOverrides] = useState<Record<number, string>>({});

  const [orderDate, setOrderDate] = useState("");
  const [shippingHandling, setShippingHandling] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [prefillLoading, setPrefillLoading] = useState<boolean>(false);

  // Unified input sizing; tabular figures for perfect column alignment
  const inputBase =
    "h-10 w-full rounded-lg border border-slate-300 px-2 text-sm leading-none focus:outline-none focus:ring-2 focus:ring-blue-500";
  const numberBase = `${inputBase} tabular-nums [appearance:textfield]`;
  const qtyNumberBase = `${numberBase} text-right`;
  const unitNumberBase = `${numberBase} text-right`; // Unit right-aligned, same width as Qty

  // Single grid template for header + rows (no wrapping; scroll if needed)
  // product (grows) | qty (9rem) | unit (9rem) | subtotal (10rem)
  const gridTemplate = "[grid-template-columns:minmax(18rem,1fr)_9rem_9rem_10rem]";

  useEffect(() => {
    (async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          api.get(apiUrl("/products/"), {
            params: { page: 0, limit: 1000, sort_by: "name", order: "asc" },
          }),
          api.get(apiUrl("/categories/")),
        ]);

        setProducts((prodRes.data?.products ?? []) as Product[]);

        const catsRaw = (Array.isArray(catRes.data) ? catRes.data : []) as any[];
        const cats = catsRaw.map((c) => ({
          id: c.id,
          name: c.name,
          base_purchase_price: Number(c.base_purchase_price) || 0,
          purchase_tiers: (c.purchase_tiers || []).map((t: any) => ({
            threshold: Number(t.threshold),
            price: Number(t.price),
          })),
        })) as Category[];
        setCategories(cats);

        if (selectedCategoryId == null && cats[0]) {
          setSelectedCategoryId(cats[0].id);
        }
      } catch {
        setProducts([]);
        setCategories([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill (edit)
  useEffect(() => {
    if (!isEdit || !routeId) return;
    setPrefillLoading(true);
    api
      .get<PurchaseOrderDTO>(apiUrl(`/purchase_orders/${routeId}`))
      .then((res) => {
        const po = res.data;
        // keep the ID we got back (most reliable for Cancel)
        setPoId(String(po.id));

        const d = new Date(po.created_at);
        const yyyyMmDd = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 10);

        setOrderDate(yyyyMmDd);
        setShippingHandling(
          typeof po.shipping_cost === "number" ? String(po.shipping_cost) : ""
        );

        const next: Record<number, number> = {};
        (po.items || []).forEach((it) => {
          if (typeof it.product_id === "number") next[it.product_id] = it.quantity || 0;
        });
        setOrderItems(next);
        setQtyDrafts({});
        setOverrides({});

        // pick category from first item's product if possible
        const firstPid = po.items?.[0]?.product_id;
        if (firstPid != null) {
          const prod = products.find((p) => p.id === firstPid);
          if (prod?.category_id != null) setSelectedCategoryId(prod.category_id);
        }
      })
      .catch(() => setErrorMessage("Failed to load purchase order for editing."))
      .finally(() => setPrefillLoading(false));
  }, [isEdit, routeId, products]);

  // Derived
  const sortedTiersCache = useMemo(() => {
    const m = new Map<number, PurchaseTier[]>();
    for (const c of categories) {
      m.set(
        c.id,
        [...(c.purchase_tiers || [])].sort((a, b) => a.threshold - b.threshold)
      );
    }
    return m;
  }, [categories]);

  const totalUnits = useMemo(
    () => Object.values(orderItems).reduce((s, q) => s + (q || 0), 0),
    [orderItems]
  );

  const dirty = useMemo(() => {
    const hasQty = Object.values(orderItems).some((q) => (q || 0) > 0);
    return (
      hasQty ||
      Object.keys(overrides).length > 0 ||
      !!orderDate ||
      (shippingHandling || "").trim() !== ""
    );
  }, [orderItems, overrides, orderDate, shippingHandling]);

  // Pricing helpers
  const getCategoryUnitPrice = (catId: number) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return 0;
    const tiers = sortedTiersCache.get(catId) || [];
    let price = cat.base_purchase_price;
    for (const t of tiers) {
      if (totalUnits >= t.threshold) price = t.price;
      else break;
    }
    return price;
  };
  const getDefaultDisplayUnit = (p: Product) => getCategoryUnitPrice(p.category_id);
  const getUnitPriceForProduct = (p: Product) => {
    const raw = overrides[p.id];
    if (raw != null && raw !== "") {
      const n = Number(raw);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
    return getDefaultDisplayUnit(p);
  };
  const getNextTierInfo = (catId: number) => {
    const tiers = sortedTiersCache.get(catId) || [];
    for (const t of tiers) {
      if (totalUnits < t.threshold)
        return { needed: t.threshold - totalUnits, nextPrice: t.price, nextQty: t.threshold };
    }
    return null;
  };

  // UI helpers
  const visibleProducts =
    selectedCategoryId == null
      ? products
      : products.filter((p) => p.category_id === selectedCategoryId);

  const updateQuantity = (pid: number, qty: number) =>
    setOrderItems((prev) => ({ ...prev, [pid]: Math.max(0, qty) }));

  const setOverride = (pid: number, value: string) =>
    setOverrides((prev) => ({ ...prev, [pid]: value }));

  const clearOverride = (pid: number) =>
    setOverrides((prev) => {
      const c = { ...prev };
      delete c[pid];
      return c;
    });

  const clearAllOverrides = () => setOverrides({});

  const itemsSubtotal = useMemo(
    () =>
      Object.entries(orderItems).reduce((sum, [idStr, qty]) => {
        const idNum = Number(idStr);
        const p = products.find((x) => x.id === idNum);
        if (!p) return sum;
        const u = getUnitPriceForProduct(p);
        return sum + (Number(qty) || 0) * u;
      }, 0),
    [orderItems, products]
  );

  const grandTotal = itemsSubtotal + (Number(shippingHandling) || 0);

  // Save
  const submit = async () => {
    const payload = {
      created_at: orderDate ? new Date(orderDate).toISOString() : undefined,
      shipping_cost: Number(shippingHandling) || 0,
      handling_cost: 0,
      items: Object.entries(orderItems)
        .filter(([, q]) => Number(q) > 0)
        .map(([pid, q]) => {
          const p = products.find((x) => x.id === Number(pid))!;
          return {
            product_id: Number(pid),
            quantity: Number(q),
            unit_cost: getUnitPriceForProduct(p),
          };
        }),
    };
    try {
      const url = apiUrl(`/purchase_orders${isEdit ? `/${routeId}` : ""}`);
      const { status, data } = await api[isEdit ? "put" : "post"](url, payload, {
        validateStatus: () => true,
      });
      if (status >= 200 && status < 300) {
        navigate(isEdit ? `/purchase-orders/${routeId}` : "/purchase-orders");
      } else {
        alert(data?.detail || "Save failed");
      }
    } catch (e: any) {
      alert(e?.message || "Network error");
    }
  };

  // Cancel (always works in edit using the actual loaded poId)
  const cancel = () => {
  // In edit mode, navigate back WITHOUT confirm (browser dialogs can be suppressed)
  if (isEdit) {
    const backId = poId ?? routeId; // use the loaded PO id first
    if (backId) navigate(`/purchase-orders/${backId}`);
    else navigate(-1); // fallback
    return;
  }

  // In create mode, keep a confirm (optional)
  if (dirty && !window.confirm("Discard changes?")) return;
  navigate("/purchase-orders");
};


  return (
    <div className="space-y-6">
      {/* Hide number spinners for consistent alignment */}
      <style>{`
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? "Edit Purchase Order" : "New Purchase Order"}
          </h1>
          <p className="text-sm text-slate-500">
            Tier pricing stays in sync across categories based on total units.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={cancel}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            {isEdit ? "Save Changes" : "Create PO"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/70 p-4 backdrop-blur">
            <label className="text-sm text-slate-600">Category</label>
            <select
              value={selectedCategoryId ?? ""}
              onChange={(e) =>
                setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {selectedCategoryId != null && (
              <span className="text-sm text-slate-500 whitespace-nowrap">
                {(() => {
                  const nxt = getNextTierInfo(selectedCategoryId);
                  return nxt
                    ? `Next tier in ${nxt.needed} → $${nxt.nextPrice.toFixed(2)}`
                    : "Already at best tier";
                })()}
              </span>
            )}
          </header>

          <div className="p-4">
            <div className="overflow-x-auto">
              {/* Header row — note px-3 matches row px to keep perfect alignment */}
              <div
                className={`grid ${gridTemplate} min-w-[700px] px-3 text-xs font-semibold text-slate-500`}
              >
                <div>Product</div>
                <div className="text-right">Qty</div>
                <div className="text-right">Unit</div>
                <div className="text-right">Subtotal</div>
              </div>

              {/* Item rows */}
              <div className="mt-2 space-y-2 min-w-[700px]">
                {visibleProducts.map((p) => {
                  const qtyNum = orderItems[p.id] || 0;
                  const qtyText =
                    Object.prototype.hasOwnProperty.call(qtyDrafts, p.id)
                      ? qtyDrafts[p.id]
                      : String(qtyNum);

                  const unit = getUnitPriceForProduct(p);
                  const isOverridden = overrides[p.id] != null && overrides[p.id] !== "";

                  // keep unit input tight on the right; only add extra padding if the reset button shows
                  const unitInputClass = `${unitNumberBase} ${
                    isOverridden ? "pr-7" : "pr-2"
                  } pl-2`;

                  return (
                    <div
                      key={p.id}
                      className={`grid ${gridTemplate} items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2`}
                    >
                      {/* Product */}
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.name}</div>
                      </div>

                      {/* Qty — clears to "" on focus if currently 0 */}
                      <div>
                        <input
                          type="number"
                          min={0}
                          value={qtyText}
                          onFocus={(e) => {
                            setQtyDrafts((prev) => ({
                              ...prev,
                              [p.id]: qtyNum === 0 ? "" : String(qtyNum),
                            }));
                            requestAnimationFrame(() => e.currentTarget.select());
                          }}
                          onChange={(e) => {
                            const v = e.target.value;
                            setQtyDrafts((prev) => ({ ...prev, [p.id]: v }));
                            const n = Number(v);
                            updateQuantity(p.id, Number.isFinite(n) ? Math.max(0, n) : 0);
                          }}
                          onBlur={() => {
                            setQtyDrafts((prev) => {
                              const next = { ...prev };
                              if (next[p.id] == null || next[p.id].trim() === "") {
                                delete next[p.id];
                                updateQuantity(p.id, 0);
                              }
                              return next;
                            });
                          }}
                          className={qtyNumberBase}
                          aria-label={`Quantity for ${p.name}`}
                        />
                      </div>

                      {/* Unit (right-aligned & same width as Qty) */}
                      <div>
                        <div className="relative">
                          <input
                            value={isOverridden ? overrides[p.id] : unit}
                            onChange={(e) => setOverride(p.id, e.target.value)}
                            className={unitInputClass}
                            aria-label={`Unit price for ${p.name}`}
                          />
                          {isOverridden && (
                            <button
                              type="button"
                              title="Reset to tier price"
                              onClick={() => clearOverride(p.id)}
                              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md border border-slate-300 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Subtotal (no wrap) */}
                      <div className="text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                        {money((Number(qtyNum) || 0) * (Number(unit) || 0))}
                      </div>
                    </div>
                  );
                })}
                {visibleProducts.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    No products in this category.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={clearAllOverrides}
                className="text-xs text-slate-500 hover:text-blue-700"
              >
                Clear all overrides
              </button>
              <div className="text-xs text-slate-500">
                Numbers use tabular figures for perfect column alignment.
              </div>
            </div>
          </div>
        </section>

        {/* Meta / Totals */}
        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Order details</h2>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm text-slate-600">Date</label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className={inputBase}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm text-slate-600">Shipping + Handling</label>
                <input
                  value={shippingHandling}
                  onChange={(e) => setShippingHandling(e.target.value)}
                  className={inputBase}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Totals</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Items</span>
                <span className="font-medium">{money(itemsSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">S + H</span>
                <span className="font-medium">
                  {money(Number(shippingHandling) || 0)}
                </span>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{money(grandTotal)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {errorMessage && <p className="text-red-600">{errorMessage}</p>}
      {prefillLoading && <p className="text-slate-500">Loading…</p>}
    </div>
  );
}
