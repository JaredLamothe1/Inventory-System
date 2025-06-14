import React, { useEffect, useState } from "react";
import axios from "axios";
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

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#8dd1e1", "#a4de6c"];

const Dashboard = () => {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [salesRes, productRes, purchaseRes] = await Promise.all([
          axios.get("http://127.0.0.1:8000/sales"),
          axios.get("http://127.0.0.1:8000/products?limit=1000"),
          axios.get("http://127.0.0.1:8000/purchase_orders"),
        ]);
        setSales(salesRes.data);
        setProducts(productRes.data.products || []);
        setPurchases(purchaseRes.data);
        setLoading(false);
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  const productCostMap: Record<number, number[]> = {};
  purchases.forEach((p: any) => {
    const arr = productCostMap[p.product_id] || [];
    arr.push(p.unit_cost);
    productCostMap[p.product_id] = arr;
  });

  const getAverageCost = (productId: number) => {
    const costs = productCostMap[productId];
    if (!costs || costs.length === 0) return 0;
    return costs.reduce((a, b) => a + b, 0) / costs.length;
  };

  const totalsByCategory: Record<string, number> = {};
  const totalsByProduct: Record<string, number> = {};
  const totalsByMonth: Record<string, number> = {};
  let totalRevenue = 0;
  let totalUnits = 0;

  sales.forEach((sale: any) => {
    const monthKey = new Date(sale.sale_date || sale.created_at)
      .toLocaleString("default", { month: "short", year: "numeric" });

    sale.items.forEach((item: any) => {
      const revenue = item.quantity * item.unit_price;
      const category = item.product?.category_name || "Uncategorized";
      const productName = item.product?.name || "Unnamed";

      totalsByCategory[category] = (totalsByCategory[category] || 0) + revenue;
      totalsByProduct[productName] = (totalsByProduct[productName] || 0) + revenue;
      totalsByMonth[monthKey] = (totalsByMonth[monthKey] || 0) + revenue;

      totalRevenue += revenue;
      totalUnits += item.quantity;
    });
  });

  const categoryChartData = Object.entries(totalsByCategory).map(([name, value]) => ({
    name,
    value,
  }));

  const topProducts = Object.entries(totalsByProduct)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  const monthLabels = getFullMonthRange(sales);
  const monthlyRevenue = monthLabels.map((label) => ({
    name: label,
    value: totalsByMonth[label] || 0,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-blue-800 mb-6">📊 Dashboard Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <MetricCard label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} color="green" />
        <MetricCard label="Units Sold" value={totalUnits} color="blue" />
        <MetricCard label="Categories Tracked" value={Object.keys(totalsByCategory).length} color="purple" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
        <ChartCard title="Revenue by Category">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie dataKey="value" data={categoryChartData} cx="50%" cy="50%" outerRadius={100} label>
                {categoryChartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 5 Products by Revenue">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Monthly Revenue Trend">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyRevenue}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#82ca9d" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

const MetricCard = ({ label, value, color }: { label: string; value: string | number; color: string }) => (
  <div className="bg-white shadow rounded p-4">
    <h2 className="text-gray-500 text-sm">{label}</h2>
    <p className={`text-2xl font-bold text-${color}-600`}>{value}</p>
  </div>
);

const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white p-6 rounded shadow">
    <h2 className="text-xl font-bold mb-4">{title}</h2>
    {children}
  </div>
);

const getFullMonthRange = (sales: any[]) => {
  const monthsSet = new Set<string>();
  sales.forEach((sale: any) => {
    const d = new Date(sale.sale_date || sale.created_at);
    const label = d.toLocaleString("default", { month: "short", year: "numeric" });
    monthsSet.add(label);
  });

  const dates = Array.from(monthsSet).map(label => new Date(label));
  if (dates.length === 0) return [];

  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  const months: string[] = [];
  const current = new Date(minDate);
  while (current <= maxDate) {
    months.push(current.toLocaleString("default", { month: "short", year: "numeric" }));
    current.setMonth(current.getMonth() + 1);
  }
  return months;
};

export default Dashboard;
