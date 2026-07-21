// src/pages/AddSaleForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type PaymentType = "cash" | "venmo" | "check" | "credit_card" | "split";

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

interface ExistingSale {
  sale_date?: string | null;
  notes?: string | null;
  sale_type?: string | null;
  payment_type?: string | null;
  apply_processing_fee?: boolean | null;
  cash_amount?: number | string | null;
  credit_card_amount?: number | string | null;
  items?: ExistingSaleItem[];
}

interface MeOut {
  credit_card_fee_flat: number;
}

const toNum = (value: unknown): number => {
  const parsed =
    typeof value === "string"
      ? parseFloat(value)
      : typeof value === "number"
        ? value
        : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const localTodayYMD = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const normalizeAPIDateToYMD = (value: unknown): string => {
  if (!value) return localTodayYMD();

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10);

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${parsed.getFullYear()}-${mm}-${dd}`;
  }

  return localTodayYMD();
};

export default function AddSaleForm() {
  const { saleId } = useParams();
  const isEditing = Boolean(saleId);
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "All">("All");

  const [saleDate, setSaleDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saleType, setSaleType] = useState("individual");
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");

  const [creditCardFeeFlat, setCreditCardFeeFlat] = useState(0);
  const [applyProcessingFee, setApplyProcessingFee] = useState(true);
  const [cashAmount, setCashAmount] = useState(0);
  const [creditCardAmount, setCreditCardAmount] = useState(0);
  const [saving, setSaving] = useState(false);

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
        const [productRes, categoryRes, meRes] = await Promise.all([
          fetch(
            `${import.meta.env.VITE_API_URL}/products/?limit=1000&page=0&sort_by=name&order=asc`,
            { headers: authHeaders() }
          ),
          fetch(`${import.meta.env.VITE_API_URL}/categories/`, {
            headers: authHeaders(),
          }),
          fetch(`${import.meta.env.VITE_API_URL}/me`, {
            headers: authHeaders(),
          }),
        ]);

        if (!productRes.ok || !categoryRes.ok || !meRes.ok) {
          throw new Error("Could not load sale data.");
        }

        const productData = await productRes.json();
        const categoryData = await categoryRes.json();
        const meData: MeOut = await meRes.json();

        setProducts(productData?.products ?? []);
        setCategories(categoryData ?? []);
        setCreditCardFeeFlat(Math.max(0, toNum(meData?.credit_card_fee_flat)));
      } catch (error) {
        console.error(error);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isEditing) setSaleDate(localTodayYMD());
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing || !saleId || products.length === 0) return;

    const allowedPayments: PaymentType[] = [
      "cash",
      "venmo",
      "check",
      "credit_card",
      "split",
    ];

    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/sales/${saleId}`, {
          headers: authHeaders(),
        });

        if (!res.ok) throw new Error("Could not load sale.");
        const data: ExistingSale = await res.json();

        setSaleDate(normalizeAPIDateToYMD(data.sale_date));
        setNotes(data.notes ?? "");
        setSaleType(data.sale_type ?? "individual");

        const normalizedPayment = String(data.payment_type ?? "cash").toLowerCase();
        const nextPayment = allowedPayments.includes(normalizedPayment as PaymentType)
          ? (normalizedPayment as PaymentType)
          : "cash";

        setPaymentType(nextPayment);
        setApplyProcessingFee(data.apply_processing_fee ?? true);
        setCashAmount(roundMoney(toNum(data.cash_amount)));
        setCreditCardAmount(roundMoney(toNum(data.credit_card_amount)));

        setItems(
          (data.items ?? []).map((item) => {
            const product = products.find((candidate) => candidate.id === item.product_id);
            return {
              product_id: item.product_id,
              quantity: toNum(item.quantity),
              unit_price: toNum(item.unit_price),
              name: (product?.name ?? "Unnamed Product").toString(),
            };
          })
        );
      } catch (error) {
        console.error(error);
        alert("There was a problem loading this sale.");
      }
    })();
  }, [isEditing, saleId, products]);

  const getSalePrice = (categoryId: number | null): number => {
    if (categoryId == null) return 0;
    const category = categories.find((candidate) => candidate.id === categoryId);
    return toNum(category?.default_sale_price);
  };

  const displayPriceFor = (product: Product) => {
    const fallback = getSalePrice(product.category_id);
    return product.resolved_price != null ? toNum(product.resolved_price) : fallback;
  };

  const addProduct = (product: Product) => {
    if (!product?.id || items.some((item) => item.product_id === product.id)) return;

    setItems((current) => [
      ...current,
      {
        product_id: product.id,
        name: (product.name ?? "Unnamed Product").toString(),
        quantity: 1,
        unit_price: Math.max(0, displayPriceFor(product)),
      },
    ]);
  };

  const setQty = (productId: number, quantity: number) => {
    setItems((current) =>
      current.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: Math.max(0, quantity) }
          : item
      )
    );
  };

  const setPrice = (productId: number, value: string) => {
    const price = Math.max(0, roundMoney(toNum(value)));
    setItems((current) =>
      current.map((item) =>
        item.product_id === productId ? { ...item, unit_price: price } : item
      )
    );
  };

  const removeLine = (productId: number) => {
    setItems((current) => current.filter((item) => item.product_id !== productId));
  };

  const filteredProducts = useMemo(() => {
    const query = searchTerm.toLowerCase();

    return products.filter((product) => {
      const name = (product.name ?? "").toString().toLowerCase();
      const matchesText = query ? name.includes(query) : true;

      if (selectedCategoryId === "All") return matchesText;

      const categoryId = Number(selectedCategoryId);
      return matchesText && Number.isFinite(categoryId) && product.category_id === categoryId;
    });
  }, [products, searchTerm, selectedCategoryId]);

  const subtotal = useMemo(
    () =>
      roundMoney(
        items.reduce(
          (sum, item) => sum + toNum(item.quantity) * toNum(item.unit_price),
          0
        )
      ),
    [items]
  );

  const hasCardPayment =
    paymentType === "credit_card" ||
    (paymentType === "split" && creditCardAmount > 0);

  const cardFee = useMemo(
    () =>
      hasCardPayment && applyProcessingFee
        ? Math.max(0, roundMoney(creditCardFeeFlat))
        : 0,
    [hasCardPayment, applyProcessingFee, creditCardFeeFlat]
  );

  const grandTotal = roundMoney(subtotal + cardFee);
  const splitTotal = roundMoney(cashAmount + creditCardAmount);
  const splitDifference = roundMoney(subtotal - splitTotal);
  const splitIsBalanced = paymentType !== "split" || Math.abs(splitDifference) < 0.01;

  const handlePaymentChange = (nextPayment: PaymentType) => {
    setPaymentType(nextPayment);

    if (nextPayment === "split") {
      setCashAmount(0);
      setCreditCardAmount(subtotal);
      setApplyProcessingFee(true);
    } else if (nextPayment === "credit_card") {
      setCashAmount(0);
      setCreditCardAmount(0);
      setApplyProcessingFee(true);
    } else {
      setCashAmount(0);
      setCreditCardAmount(0);
      setApplyProcessingFee(false);
    }
  };

  const handleCashAmountChange = (value: string) => {
    const nextCash = Math.max(0, roundMoney(toNum(value)));
    setCashAmount(nextCash);
  };

  const useRemainingForCard = () => {
    setCreditCardAmount(Math.max(0, roundMoney(subtotal - cashAmount)));
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      alert("Please add at least one product.");
      return;
    }

    if (items.some((item) => item.quantity <= 0)) {
      alert("Each product must have a quantity greater than zero.");
      return;
    }

    if (paymentType === "split") {
      if (cashAmount <= 0 || creditCardAmount <= 0) {
        alert("A split payment must include both a cash amount and a credit-card amount.");
        return;
      }

      if (!splitIsBalanced) {
        alert(
          `The split payment must equal the ${subtotal.toFixed(2)} subtotal. It is currently off by $${Math.abs(splitDifference).toFixed(2)}.`
        );
        return;
      }
    }

    const payload = {
      sale_date: saleDate || null,
      notes: notes || null,
      sale_type: saleType || "individual",
      payment_type: paymentType,
      apply_processing_fee: hasCardPayment ? applyProcessingFee : false,
      cash_amount: paymentType === "split" ? cashAmount : null,
      credit_card_amount: paymentType === "split" ? creditCardAmount : null,
      items: items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    };

    try {
      setSaving(true);
      const url = `${import.meta.env.VITE_API_URL}/sales${isEditing ? `/${saleId}` : ""}`;
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.detail || "Save failed");
      }

      navigate("/sales");
    } catch (error) {
      alert(error instanceof Error ? error.message : "There was a problem saving this sale.");
    } finally {
      setSaving(false);
    }
  };

  const disabled = items.length === 0 || saving || !splitIsBalanced;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Edit Sale" : "New Sale"}
          </h1>
          <p className="text-sm text-slate-500">
            Add products, choose payment details, and confirm the total.
          </p>
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
            className={`rounded-lg px-4 py-2 text-sm text-white ${
              disabled ? "cursor-not-allowed bg-slate-300" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Create Sale"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <header className="sticky top-[4.5rem] z-10 flex items-center gap-3 border-b border-slate-200 bg-white/80 p-4 backdrop-blur">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search products…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value as any)}
            >
              <option value="All">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </header>

          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addProduct(product)}
                className="group rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-blue-300 hover:shadow"
              >
                <div className="font-medium">{product.name}</div>
                <div className="mt-1 text-sm text-slate-500">
                  Default price: ${displayPriceFor(product).toFixed(2)}
                </div>
                <div className="mt-3 text-xs text-blue-700 opacity-0 transition group-hover:opacity-100">
                  Click to add
                </div>
              </button>
            ))}

            {filteredProducts.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
                No products match your filter.
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Sale details</h2>

            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm text-slate-600">Date</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(event) => setSaleDate(event.target.value)}
                  className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="text-sm text-slate-600">Sale type</label>
                <select
                  value={saleType}
                  onChange={(event) => setSaleType(event.target.value)}
                  className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="individual">Individual</option>
                  <option value="batch-daily">Batch - Daily</option>
                  <option value="batch-weekly">Batch - Weekly</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="text-sm text-slate-600">Payment</label>
                <select
                  value={paymentType}
                  onChange={(event) => handlePaymentChange(event.target.value as PaymentType)}
                  className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">Cash</option>
                  <option value="venmo">Venmo</option>
                  <option value="check">Check</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="split">Split: Cash + Card</option>
                </select>
              </div>

              {paymentType === "split" && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Cash amount
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={cashAmount}
                      onChange={(event) => handleCashAmountChange(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-600">
                        Credit-card amount
                      </label>
                      <button
                        type="button"
                        onClick={useRemainingForCard}
                        className="text-xs font-medium text-blue-700 hover:underline"
                      >
                        Use remaining
                      </button>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={creditCardAmount}
                      onChange={(event) =>
                        setCreditCardAmount(Math.max(0, roundMoney(toNum(event.target.value))))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div
                    className={`rounded-lg px-3 py-2 text-xs ${
                      splitIsBalanced
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {splitIsBalanced
                      ? `Split matches the $${subtotal.toFixed(2)} subtotal.`
                      : `Split is ${splitDifference > 0 ? "short" : "over"} by $${Math.abs(splitDifference).toFixed(2)}.`}
                  </div>
                </div>
              )}

              {hasCardPayment && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={applyProcessingFee}
                      onChange={(event) => setApplyProcessingFee(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-800">
                        Apply credit-card fee
                      </span>
                      <span className="block text-xs text-slate-500">
                        Turn this off when the fee was already collected with the acupuncture service.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              <textarea
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Notes (optional)"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Line items</h2>

            <div className="space-y-3">
              {items.map((line) => (
                <div key={line.product_id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{line.name}</div>
                    <button
                      onClick={() => removeLine(line.product_id)}
                      className="text-sm text-slate-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Quantity</label>
                      <input
                        type="number"
                        min={0}
                        value={line.quantity}
                        onChange={(event) =>
                          setQty(line.product_id, Number(event.target.value))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Unit price</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unit_price}
                        onChange={(event) => setPrice(line.product_id, event.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex flex-col justify-end text-right text-sm">
                      <div className="text-slate-500">Line total</div>
                      <div className="font-semibold">
                        ${(line.quantity * line.unit_price).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
                  No items yet.
                </div>
              )}
            </div>

            <div className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>

              {paymentType === "split" && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Cash portion</span>
                    <span>${cashAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Card portion</span>
                    <span>${creditCardAmount.toFixed(2)}</span>
                  </div>
                </>
              )}

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