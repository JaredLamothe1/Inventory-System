// src/components/dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#8dd1e1", "#a4de6c", "#d0ed57", "#a28ae5"] as const;

type Product = {
  id: number;
  name: string;
  category_name?: string;
  quantity_in_stock?: number;
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

type POItem = {
  quantity: number;
  unit_cost: number;
  product: { id: number; name: string };
};

type PurchaseOrder = {
  id: number;
  created_at: string;
  items: POItem[];
};

const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

const Dashboard: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const config = { headers: { Authorization: `Bearer ${token}` } };

        const [salesRes, productRes, poRes] = await Promise.all([
          api.get(`${import.meta.env.VITE_API_URL}/sales/`, config),
          api.get(`${import.meta.env.VITE_API_URL}/products/?limit=1000`, config),
          api.get(`${import.meta.env.VITE_API_URL}/purchase_orders/`, config),
        ]);

        setSales(salesRes.data || []);
        setProducts((productRes.data?.products ?? []) as Product[]);
        setPurchaseOrders(poRes.data || []);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ---------- Dates ----------
  const now = new Date();
  const currentYear = now.getFullYear();
  const isInMonth = (d: Date) => d.getFullYear() === currentYear && d.getMonth() === now.getMonth();
  const isInYear  = (d: Date) => d.getFullYear() === currentYear;
  const saleDate  = (s: Sale)   => new Date(s.sale_date ?? s.created_at);

  // ---------- Defensive filter: ignore empty/itemless or invalid-date sales ----------
  const validSales = useMemo(() => {
    return sales.filter((s) => {
      const hasItems = Array.isArray(s.items) && s.items.length > 0;
      const d = saleDate(s);
      const validDate = !Number.isNaN(d.getTime());
      return hasItems && validDate;
    });
  }, [sales]);

  // ---------- Cost basis: Weighted Avg (lifetime to the end of today) ----------
  const avgCostByProduct = useMemo(() => {
    const totalUnits: Record<number, number> = {};
    const totalCost: Record<number, number> = {};
    for (const po of purchaseOrders) {
      const pod = new Date(po.created_at);
      if (Number.isNaN(pod.getTime())) continue;
      for (const it of po.items) {
        const id = it.product.id;
        totalUnits[id] = (totalUnits[id] || 0) + it.quantity;
        totalCost[id]  = (totalCost[id]  || 0) + it.quantity * it.unit_cost;
      }
    }
    const avg: Record<number, number> = {};
    for (const idStr of Object.keys(totalUnits)) {
      const id = Number(idStr);
      avg[id] = totalUnits[id] ? totalCost[id] / totalUnits[id] : 0;
    }
    return avg;
  }, [purchaseOrders]);

  // ---------- Aggregations ----------
  const ytdSales = useMemo(() => validSales.filter(s => isInYear(saleDate(s))), [validSales]);
  const mtdSales = useMemo(() => validSales.filter(s => isInMonth(saleDate(s))), [validSales]);

  const sumRevenue = (salesList: Sale[]) => {
    let rev = 0;
    for (const s of salesList) {
      for (const it of s.items) rev += it.quantity * it.unit_price;
    }
    return rev;
  };

  const sumCOGS = (salesList: Sale[]) => {
    let cost = 0;
    for (const s of salesList) {
      for (const it of s.items) cost += it.quantity * (avgCostByProduct[it.product.id] || 0);
    }
    return cost;
  };

  const ytdRevenue = useMemo(() => sumRevenue(ytdSales), [ytdSales]);
  const ytdCOGS    = useMemo(() => sumCOGS(ytdSales), [ytdSales, avgCostByProduct]);
  const ytdProfit  = useMemo(() => ytdRevenue - ytdCOGS, [ytdRevenue, ytdCOGS]);
  const ytdOrders  = useMemo(() => ytdSales.length, [ytdSales]);
  const ytdUnits   = useMemo(() => ytdSales.reduce((a, s) => a + s.items.reduce((x, i) => x + i.quantity, 0), 0), [ytdSales]);
  const ytdAOV     = useMemo(() => (ytdOrders ? ytdRevenue / ytdOrders : 0), [ytdRevenue, ytdOrders]);

  const mtdRevenue = useMemo(() => sumRevenue(mtdSales), [mtdSales]);

  // Revenue by category & top products (YTD)
  const { categoryTotalsYTD, topProductsYTD } = useMemo(() => {
    const byCat: Record<string, number> = {};
    const byProduct: Record<string, number> = {};
    for (const s of ytdSales) {
      for (const it of s.items) {
        const cat  = it.product?.category_name || "Uncategorized";
        const name = it.product?.name || "Unnamed";
        const rev  = it.quantity * it.unit_price;
        byCat[cat] = (byCat[cat] || 0) + rev;
        byProduct[name] = (byProduct[name] || 0) + rev;
      }
    }
    const top = Object.entries(byProduct)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
    return { categoryTotalsYTD: byCat, topProductsYTD: top };
  }, [ytdSales]);

  // Monthly series for current year (Revenue + Profit)
  const monthlyYTD = useMemo(() => {
    const rows = Array.from({ length: 12 }).map((_, m) => ({
      name: monthNames[m],
      revenue: 0,
      profit: 0,
      cost: 0,
      orders: 0,
      units: 0,
    }));
    for (const s of ytdSales) {
      const d = saleDate(s);
      const m = d.getMonth();
      rows[m].orders += 1;
      for (const it of s.items) {
        const rev  = it.quantity * it.unit_price;
        const cost = it.quantity * (avgCostByProduct[it.product.id] || 0);
        rows[m].revenue += rev;
        rows[m].cost    += cost;
        rows[m].profit   = rows[m].revenue - rows[m].cost;
        rows[m].units   += it.quantity;
      }
    }
    return rows;
  }, [ytdSales, avgCostByProduct]);

  // Low stock alert (top 5)
  const lowStock = useMemo(() => {
    const withQty = products.filter(p => typeof p.quantity_in_stock === "number");
    return withQty
      .filter(p => (p.quantity_in_stock ?? 0) <= 5)
      .sort((a, b) => (a.quantity_in_stock ?? 0) - (b.quantity_in_stock ?? 0))
      .slice(0, 5);
  }, [products]);

  // Recent activity (exclude empties)
  const recentSales = useMemo(
    () => [...validSales].sort((a, b) => +saleDate(b) - +saleDate(a)).slice(0, 5),
    [validSales]
  );
  const recentPOs = useMemo(
    () => [...purchaseOrders].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5),
    [purchaseOrders]
  );

  if (loading) return <div className="p-6">Loading…</div>;

  // --- UI DATA ---
  const categoryChartData = Object.entries(categoryTotalsYTD).map(([name, value]) => ({ name, value }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Header + quick actions */}
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">🏠 Dashboard</h1>
          <p className="text-gray-600">At-a-glance health of your business. This year’s momentum with quick actions.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/sales/new" className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow">
            + New Sale
          </Link>
          <Link to="/purchase-orders/new" className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow">
            + New Purchase Order
          </Link>
          <Link to="/analytics" className="px-4 py-2 rounded-xl bg-slate-700 text-white hover:bg-slate-800 shadow">
            Open Analytics
          </Link>
          <Link to={`/analytics?year=${currentYear}`} className="px-4 py-2 rounded-xl bg-slate-500 text-white hover:bg-slate-600 shadow">
            Analytics (This Year)
          </Link>
        </div>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI label="Revenue (MTD)" value={ytdCurrency(mtdRevenue)} />
        <KPI label="Revenue (YTD)" value={ytdCurrency(ytdRevenue)} />
        <KPI label="Net Profit (YTD)" value={ytdCurrency(ytdProfit)} emphasize />
        <KPI label="Orders (YTD)" value={ytdOrders.toLocaleString()} />
        <KPI label="AOV (YTD)" value={ytdCurrency(ytdAOV)} />
      </section>

      {/* Alerts + Recent activity */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Low Stock Alerts">
          {lowStock.length === 0 ? (
            <p className="text-gray-500 text-sm">No products at or below threshold (≤5).</p>
          ) : (
            <ul className="divide-y">
              {lowStock.map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm px-2 py-0.5 rounded bg-rose-50 text-rose-700">
                    {p.quantity_in_stock} in stock
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent Sales">
          {recentSales.length === 0 ? (
            <p className="text-gray-500 text-sm">No sales yet.</p>
          ) : (
            <ul className="divide-y">
              {recentSales.map((s) => {
                const d = saleDate(s);
                const units = s.items.reduce((a, i) => a + i.quantity, 0);
                const revenue = s.items.reduce((a, i) => a + i.quantity * i.unit_price, 0);
                return (
                  <li key={s.id} className="py-2 flex items-center justify-between">
                    <span className="font-medium">{d.toLocaleDateString()}</span>
                    <span className="text-sm text-gray-600">{units} units</span>
                    <span className="text-sm font-semibold">${revenue.toFixed(2)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Recent Purchase Orders">
          {recentPOs.length === 0 ? (
            <p className="text-gray-500 text-sm">No purchase orders yet.</p>
          ) : (
            <ul className="divide-y">
              {recentPOs.map((po) => {
                const d = new Date(po.created_at);
                const units = po.items?.reduce((a, i) => a + i.quantity, 0) ?? 0;
                const spend = po.items?.reduce((a, i) => a + i.quantity * i.unit_cost, 0) ?? 0;
                return (
                  <li key={po.id} className="py-2 flex items-center justify-between">
                    <span className="font-medium">{d.toLocaleDateString()}</span>
                    <span className="text-sm text-gray-600">{units} units</span>
                    <span className="text-sm font-semibold">-${spend.toFixed(2)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Top Categories (YTD)">
          {categoryChartData.length === 0 ? (
            <p className="text-gray-500 text-sm">No category revenue yet this year.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie dataKey="value" data={categoryChartData} cx="50%" cy="50%" outerRadius={105} label>
                  {categoryChartData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Top 5 Products by Revenue (YTD)">
          {topProductsYTD.length === 0 ? (
            <p className="text-gray-500 text-sm">No product revenue yet this year.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProductsYTD}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </section>

      <section>
        <Card title={`Monthly Revenue & Profit — ${currentYear}`}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={monthlyYTD}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#82ca9d" name="Revenue" />
              <Line type="monotone" dataKey="profit" stroke="#8884d8" name="Profit" />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 text-xs text-gray-500">
            Profit uses weighted average cost across all recorded purchase orders (lifetime).
          </div>
        </Card>
      </section>
    </div>
  );
};

/* ---------------- UI bits ---------------- */

const KPI: React.FC<{ label: string; value: string; emphasize?: boolean }> = ({ label, value, emphasize }) => (
  <div className="bg-white rounded-2xl shadow p-5">
    <div className="text-gray-600 text-sm">{label}</div>
    <div className={`mt-1 text-2xl font-bold tabular-nums ${emphasize ? "text-blue-700" : "text-gray-900"}`}>{value}</div>
  </div>
);

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-2xl shadow p-5">
    <h2 className="text-lg font-semibold mb-3">{title}</h2>
    {children}
  </div>
);

/* ---------------- helpers ---------------- */

const ytdCurrency = (v: number) => `$${(v ?? 0).toFixed(2)}`;

export default Dashboard;
