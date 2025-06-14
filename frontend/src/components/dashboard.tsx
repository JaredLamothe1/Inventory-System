import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell
} from "recharts";
import { useEffect, useState } from "react";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7f50", "#00c49f", "#ffbb28"];

type ChartCardProps = {
  title: string;
  children: React.ReactNode;
};

const ChartCard: React.FC<ChartCardProps> = ({ title, children }) => (
  <div className="bg-white p-6 rounded shadow">
    <h2 className="text-xl font-bold mb-4">{title}</h2>
    {children}
  </div>
);

type MetricCardProps = {
  label: string;
  value: string | number;
  color: string;
};

const MetricCard: React.FC<MetricCardProps> = ({ label, value, color }) => (
  <div className="bg-white shadow rounded p-4">
    <h2 className="text-gray-500 text-sm">{label}</h2>
    <p className={`text-2xl font-bold text-${color}-600`}>{value}</p>
  </div>
);

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    revenue: 0,
    profit: 0,
    sales: 0,
    units: 0,
  });

  const [categoryChartData, setCategoryChartData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:8000/analytics/dashboard");
        const data = await res.json();

        setMetrics({
          revenue: data.total_revenue,
          profit: data.total_profit,
          sales: data.total_sales,
          units: data.total_units,
        });

        setCategoryChartData(data.revenue_by_category || []);
        setTopProducts(data.top_products_by_revenue || []);
        setMonthlyRevenue(data.monthly_revenue || []);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      }
    };

    fetchData();
  }, []);

  const formatNumber = (num: number) =>
    num.toLocaleString("en-US", { minimumFractionDigits: 0 });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-10">
      <h1 className="text-3xl font-bold mb-6">Dashboard Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <MetricCard
          label="Total Revenue"
          value={`$${formatNumber(metrics.revenue)}`}
          color="green"
        />
        <MetricCard
          label="Total Profit"
          value={`$${formatNumber(metrics.profit)}`}
          color="blue"
        />
        <MetricCard
          label="Sales Count"
          value={formatNumber(metrics.sales)}
          color="purple"
        />
        <MetricCard
          label="Units Sold"
          value={formatNumber(metrics.units)}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <ChartCard title="Revenue by Category">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              
                {categoryChartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              
              
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 5 Products by Revenue">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts}>
              <XAxis dataKey="name" />
              <YAxis />
              
              
              
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

    </div>
  );
};

export default Dashboard;
