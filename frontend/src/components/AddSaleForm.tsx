import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface Product {
  id: number;
  name?: string | null;
  category_id: number | null;
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
  unit_price: number;
}

const AddSaleForm = () => {
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

  const navigate = useNavigate();

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  // ---------- Load products & categories ----------
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [productRes, categoryRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/products/?limit=1000&page=0&sort_by=name&order=asc`, {
            headers: authHeaders(),
          }),
          fetch(`${import.meta.env.VITE_API_URL}/categories/`, {
            headers: authHeaders(),
          }),
        ]);

        if (!productRes.ok) throw new Error("Failed to load products");
        if (!categoryRes.ok) throw new Error("Failed to load categories");

        const productData = await productRes.json();
        const categoryData = await categoryRes.json();

        setProducts((productData?.products ?? []) as Product[]);
        setCategories((categoryData ?? []) as Category[]);
      } catch (err) {
        console.error("Failed to fetch products or categories", err);
      }
    };

    fetchAll();
  }, []);

  // ---------- Default date for new sale ----------
  useEffect(() => {
    if (!isEditing) {
      setSaleDate(new Date().toISOString().split("T")[0]);
    }
  }, [isEditing]);

  // ---------- Load existing sale when editing ----------
  useEffect(() => {
    if (!isEditing || !saleId) return;

    const fetchSale = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/sales/${saleId}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error("Sale not found");

        const data = await res.json();

        const rawDate: string | null = data?.sale_date ?? null;
        const normalized = rawDate ? String(rawDate).split("T")[0] : new Date().toISOString().split("T")[0];
        setSaleDate(normalized);

        setNotes(data?.notes ?? "");
        setSaleType(data?.sale_type ?? "individual");

        const itemDetails: SaleItem[] = (data?.items ?? []).map((item: ExistingSaleItem) => {
          const product = products.find((p) => p.id === item.product_id);
          return {
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            name: (product?.name ?? "Unnamed Product").toString(),
          };
        });
        setItems(itemDetails);
      } catch (err) {
        console.error("Failed to fetch sale", err);
      }
    };

    fetchSale();
  }, [isEditing, saleId, products]);

  // ---------- Helpers ----------
  const getSalePrice = (categoryId: number): number => {
    const category = categories.find((cat) => cat.id === categoryId);
    const price = category?.default_sale_price;
    return typeof price === "number" && !Number.isNaN(price) ? price : 0;
  };

  const handleAddProduct = (product: Product) => {
    if (!product?.id) return;
    if (items.find((i) => i.product_id === product.id)) return;

    const catId = Number(product.category_id ?? NaN);
    const price = Number.isFinite(catId) ? getSalePrice(catId) : 0;

    setItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        name: (product.name ?? "Unnamed Product").toString(),
        quantity: 1,
        unit_price: price,
      },
    ]);
  };

  const handleQuantityChange = (productId: number, qtyInput: number) => {
    const qty = Number.isFinite(qtyInput) ? qtyInput : 0;
    setItems((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, quantity: Math.max(0, qty) } : item
      )
    );
  };

  const handlePriceChange = (productId: number, priceInput: string) => {
    // Allow blank while typing, clamp on commit
    let val = priceInput.trim();
    if (val === "") {
      setItems((prev) =>
        prev.map((item) =>
          item.product_id === productId ? { ...item, unit_price: 0 } : item
        )
      );
      return;
    }
    const num = Number(val);
    setItems((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, unit_price: Number.isFinite(num) ? Math.max(0, parseFloat(num.toFixed(2))) : item.unit_price }
          : item
      )
    );
  };

  const handleRemove = (productId: number) => {
    setItems((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      alert("Please add at least one product to the sale.");
      return;
    }

    const payload = {
      sale_date: saleDate || null,
      notes: notes || null,
      sale_type: saleType,
      items: items.map(({ product_id, quantity, unit_price }) => ({
        product_id,
        quantity,
        unit_price: Number.isFinite(unit_price) ? Number(unit_price) : 0,
      })),
    };

    const method = isEditing ? "PUT" : "POST";
    const url = isEditing
      ? `${import.meta.env.VITE_API_URL}/sales/${saleId}`
      : `${import.meta.env.VITE_API_URL}/sales/`;

    try {
      const res = await fetch(url, {
        method,
               headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        navigate("/sales");
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData?.detail || "Failed to save sale.");
      }
    } catch (e) {
      console.error("Save sale failed", e);
      alert("Failed to save sale.");
    }
  };

  // ---------- Filtering (defensive) ----------
  const filteredProducts = useMemo(() => {
    const term = (searchTerm || "").toLowerCase();
    return products.filter((p) => {
      const name = (p.name ?? "").toString().toLowerCase();
      const inText = term ? name.includes(term) : true;

      if (selectedCategoryId === "All") return inText;
      const catId = Number(selectedCategoryId);
      return inText && Number.isFinite(catId) && p.category_id === catId;
    });
  }, [products, searchTerm, selectedCategoryId]);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unit_price || 0), 0),
    [items]
  );

  const selectedCategoryPrice = useMemo(() => {
    if (selectedCategoryId === "All") return null;
    const idNum = Number(selectedCategoryId);
    if (!Number.isFinite(idNum)) return null;
    return getSalePrice(idNum);
  }, [selectedCategoryId, categories]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-800">
        {isEditing ? "✏️ Edit Sale" : "🧾 New Sale"}
      </h1>

      {/* Sale Details */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-blue-800">Sale Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-blue-700 mb-1">Sale Date</label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="w-full border border-blue-300 px-3 py-2 rounded-md shadow-inner"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-blue-700 mb-1">Sale Type</label>
            <select
              value={saleType}
              onChange={(e) => setSaleType(e.target.value)}
              className="w-full border border-blue-300 px-3 py-2 rounded-md shadow-inner"
            >
              <option value="individual">Individual Customer</option>
              <option value="batch-daily">Daily Summary</option>
              <option value="batch-weekly">Weekly Summary</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-blue-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional (e.g., 'Week of July 1')"
              className="w-full border border-blue-300 px-3 py-2 rounded-md shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* Product Search & Categories */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <input
            type="text"
            placeholder="🔍 Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 border border-gray-300 px-4 py-2 rounded-md shadow-sm w-full sm:w-auto"
          />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategoryId("All")}
              className={`px-3 py-1 rounded-md border text-sm font-medium ${
                selectedCategoryId === "All"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategoryId(category.id)}
                className={`px-3 py-1 rounded-md border text-sm font-medium ${
                  selectedCategoryId === category.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {selectedCategoryPrice !== null && (
          <p className="text-sm text-gray-600">
            Sale price for this category:{" "}
            <span className="font-semibold text-blue-700">
              ${Number(selectedCategoryPrice).toFixed(2)}
            </span>
          </p>
        )}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6 max-h-96 overflow-y-auto">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => handleAddProduct(product)}
              className="bg-white border rounded-lg p-3 text-left shadow-sm hover:shadow-md hover:border-blue-400 transition"
            >
              <div className="font-semibold text-gray-800">{(product.name ?? "Unnamed Product").toString()}</div>
              <div className="text-xs text-gray-400 italic mt-1">Click to add</div>
            </button>
          ))
        ) : (
          <p className="text-sm text-gray-500 col-span-full">
            No products match your search and category.
          </p>
        )}
      </div>

      {/* Selected Items */}
      {items.length > 0 ? (
        <div className="space-y-4 mb-6">
          {items.map((item) => (
            <div
              key={item.product_id}
              className="bg-white border rounded-lg p-4 shadow-sm space-y-3"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">{item.name}</h3>
                <button
                  onClick={() => handleRemove(item.product_id)}
                  className="text-red-600 text-sm hover:underline"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center text-sm">
                <div className="flex items-center gap-2">
                  <label className="text-gray-600 w-20">Quantity:</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(item.product_id, Number(e.target.value))}
                    className="border px-2 py-1 w-24 rounded-md"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-gray-600 w-20">Unit Price:</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={Number(item.unit_price ?? 0).toFixed(2)}
                    onChange={(e) => handlePriceChange(item.product_id, e.target.value)}
                    className="border px-2 py-1 w-28 rounded-md"
                  />
                </div>

                <div className="ml-auto sm:ml-0 text-right sm:text-left font-medium text-blue-700">
                  Line Total: ${Number((item.unit_price || 0) * (item.quantity || 0)).toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-6">No items selected yet.</p>
      )}

      {/* Total & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
        <div className="text-2xl font-bold text-gray-800">
          Total: <span className="text-blue-700">${Number(total).toFixed(2)}</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/sales")}
            className="px-5 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow"
          >
            {isEditing ? "Save Changes" : "Submit Sale"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddSaleForm;
