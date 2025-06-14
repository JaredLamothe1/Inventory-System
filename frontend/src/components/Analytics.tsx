// src/components/Analytics.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";

type Product = {
  id: number;
  name: string;
  category_name?: string;
};

type SaleItem = {
  quantity: number;
  unit_price: number;
  product: Product;
};

type Sale = {
  id: number;
  created_at: string;
  sale_date?: string;
  items: SaleItem[];
};

type PurchaseItem = {
  quantity: number;
  unit_cost: number;
  product: Product;
};

type PurchaseOrder = {
  id: number;
  created_at: string;
  items: PurchaseItem[];
};

const TIME_OPTIONS = ["This Week", "This Month", "This Year", "All Time"];

const getDateRange = (range: string): [Date, Date] => {
  const now = new Date();
  let start: Date;
  switch (range) {
    case "This Week":
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      break;
    case "This Month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "This Year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date("2000-01-01");
      break;
  }
  return [start, now];
};

const Analytics = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("This Year");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      const [salesRes, purchaseRes, productRes] = await Promise.all([
        axios.get("${import.meta.env.VITE_API_URL}/sales"),
        axios.get("${import.meta.env.VITE_API_URL}/purchase_orders"),
        axios.get("${import.meta.env.VITE_API_URL}/products?limit=1000"),
      ]);
      setSales(salesRes.data);
      setPurchases(purchaseRes.data);
      setProducts(productRes.data.products);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const [startDate, endDate] = getDateRange(timeRange);

  const filteredSales = sales.filter((s) => {
    const d = new Date(s.sale_date ?? s.created_at);
    return d >= startDate && d <= endDate;
  });

  const filteredPurchases = purchases.filter((p) => {
    const d = new Date(p.created_at);
    return d >= startDate && d <= endDate;
  });

  const averageCost: Record<number, number> = {};
  const unitsPurchased: Record<number, number> = {};

  purchases.forEach((po) =>
    po.items.forEach((item) => {
      const id = item.product.id;
      const totalCost = (averageCost[id] || 0) * (unitsPurchased[id] || 0);
      const newTotal = totalCost + item.unit_cost * item.quantity;
      unitsPurchased[id] = (unitsPurchased[id] || 0) + item.quantity;
      averageCost[id] = newTotal / unitsPurchased[id];
    })
  );

  let revenue = 0;
  let cost = 0;
  const revenueByCategory: Record<string, number> = {};
  const profitByProduct: Record<string, number> = {};

  filteredSales.forEach((s) => {
    s.items.forEach((i) => {
      const id = i.product.id;
      const q = i.quantity;
      const itemRevenue = q * i.unit_price;
      const itemCost = q * (averageCost[id] || 0);
      const cat = i.product.category_name || "Uncategorized";
      const name = i.product.name;

      revenue += itemRevenue;
      cost += itemCost;
      revenueByCategory[cat] = (revenueByCategory[cat] || 0) + itemRevenue;
      profitByProduct[name] = (profitByProduct[name] || 0) + (itemRevenue - itemCost);
    });
  });

  const netProfit = revenue - cost;
  const topProducts = Object.entries(profitByProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const productDetails = products.find((p) => p.id === selectedProductId);
  const productStats = {
    unitsSold: 0,
    unitsPurchased: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
    manualAdjustment: false,
  };

  filteredSales.forEach((s) =>
    s.items.forEach((i) => {
      if (i.product.id === selectedProductId) {
        productStats.unitsSold += i.quantity;
        productStats.revenue += i.unit_price * i.quantity;
        productStats.cost += (averageCost[selectedProductId!] || 0) * i.quantity;
      }
    })
  );
  filteredPurchases.forEach((po) =>
    po.items.forEach((item) => {
      if (item.product.id === selectedProductId) {
        productStats.unitsPurchased += item.quantity;
      }
    })
  );

  productStats.profit = productStats.revenue - productStats.cost;
  productStats.manualAdjustment = productStats.unitsSold > 0 && productStats.unitsPurchased === 0;

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-800">📊 Business Analytics</h1>

      <div className="mb-6">
        <label className="mr-3 font-semibold">Time Range:</label>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          {TIME_OPTIONS.map((opt) => (
            <option key={opt}>{opt}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white shadow p-4 rounded">
          <h2 className="text-gray-600">Revenue</h2>
          <p className="text-2xl font-bold text-green-600">${revenue.toFixed(2)}</p>
        </div>
        <div className="bg-white shadow p-4 rounded">
          <h2 className="text-gray-600">COGS</h2>
          <p className="text-2xl font-bold text-red-600">${cost.toFixed(2)}</p>
        </div>
        <div className="bg-white shadow p-4 rounded">
          <h2 className="text-gray-600">Net Profit</h2>
          <p className="text-2xl font-bold text-blue-600">${netProfit.toFixed(2)}</p>
        </div>
      </div>

      <div className="mb-8 bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Revenue by Category</h2>
        <ul className="space-y-1">
          {Object.entries(revenueByCategory).map(([cat, val]) => (
            <li key={cat} className="flex justify-between">
              <span>{cat}</span>
              <span className="font-semibold">${val.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-8 bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Top Products by Profit</h2>
        <ul className="space-y-1">
          {topProducts.map(([name, val]) => (
            <li key={name} className="flex justify-between">
              <span>{name}</span>
              <span className="font-semibold">${val.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-12 bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Product Profitability Lookup</h2>
        <select
          onChange={(e) => setSelectedProductId(Number(e.target.value))}
          value={selectedProductId ?? ""}
          className="border px-3 py-2 rounded w-full max-w-md mb-4"
        >
          <option value="">Select a product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {selectedProductId && productDetails && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 p-4 rounded shadow">
              <p>Product</p>
              <p className="font-bold">{productDetails.name}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded shadow">
              <p>Category</p>
              <p className="font-bold">{productDetails.category_name ?? "Uncategorized"}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded shadow">
              <p>Units Sold</p>
              <p className="font-bold">{productStats.unitsSold}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded shadow">
              <p>Units Purchased</p>
              <p className="font-bold">{productStats.unitsPurchased}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded shadow">
              <p>Revenue</p>
              <p className="font-bold text-green-700">${productStats.revenue.toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded shadow">
              <p>COGS</p>
              <p className="font-bold text-red-700">${productStats.cost.toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded shadow">
              <p>Net Profit</p>
              <p className="font-bold text-blue-700">${productStats.profit.toFixed(2)}</p>
            </div>
            {productStats.manualAdjustment && (
              <div className="bg-yellow-100 text-yellow-800 p-4 rounded shadow col-span-2">
                ⚠️ This product was sold without any recorded purchases. Inventory may have been manually adjusted.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
