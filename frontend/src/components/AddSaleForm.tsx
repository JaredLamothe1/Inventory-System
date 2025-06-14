import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Product {
  id: number;
  name: string;
  category_id: number;
}

interface Category {
  id: number;
  name: string;
  default_sale_price: number;
}

interface SaleItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  name: string;
}

const AddSaleForm = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "All">("All");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [saleType, setSaleType] = useState("individual");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const productRes = await fetch(`${import.meta.env.VITE_API_URL}/products/?limit=1000&page=0&sort_by=name&order=asc`);
        const productData = await productRes.json();
        setProducts(productData.products ?? []);

        const categoryRes = await fetch(`${import.meta.env.VITE_API_URL}/categories/`);
        const categoryData = await categoryRes.json();
        setCategories(categoryData ?? []);
      } catch (err) {
        console.error("Failed to fetch products or categories", err);
      }
    };
    fetchAll();
  }, []);

  const getSalePrice = (categoryId: number): number => {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.default_sale_price ?? 0;
  };

  const handleAddProduct = (product: Product) => {
    const existing = items.find((i) => i.product_id === product.id);
    if (existing) return;

    const price = getSalePrice(product.category_id);
    setItems([
      ...items,
      {
        product_id: product.id,
        name: product.name,
        quantity: 1,
        unit_price: price,
      },
    ]);
  };

  const handleQuantityChange = (productId: number, qty: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: Math.max(0, qty) }
          : item
      )
    );
  };

  const handleRemove = (productId: number) => {
    setItems((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const handleSubmit = async () => {
    const payload = {
      sale_date: saleDate,
      notes: notes || null,
      sale_type: saleType,
      items: items.map(({ product_id, quantity, unit_price }) => ({
        product_id,
        quantity,
        unit_price,
      })),
    };

    const res = await fetch("${import.meta.env.VITE_API_URL}/sales/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      navigate("/sales");
    } else {
      const errorData = await res.json();
      alert(errorData.detail || "Failed to save sale.");
    }
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedCategoryId === "All" || product.category_id === selectedCategoryId)
  );

  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  const selectedCategoryPrice =
    selectedCategoryId !== "All"
      ? getSalePrice(selectedCategoryId as number)
      : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-800">🧾 New Sale</h1>

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
              ${selectedCategoryPrice.toFixed(2)}
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
              <div className="font-semibold text-gray-800">{product.name}</div>
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
              className="bg-white border rounded-lg p-4 shadow-sm space-y-2"
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
              <div className="flex items-center gap-3 text-sm">
                <label className="text-gray-600">Quantity:</label>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    handleQuantityChange(item.product_id, Number(e.target.value))
                  }
                  className="border px-2 py-1 w-20 rounded-md"
                />
                <span className="ml-auto font-medium text-blue-700">
                  = ${Number(item.unit_price * item.quantity).toFixed(2)}
                </span>
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
          Total: <span className="text-blue-700">${total.toFixed(2)}</span>
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
            Submit Sale
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddSaleForm;
