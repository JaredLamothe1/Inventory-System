// src/components/Analytics.tsx
import React, { useEffect, useMemo, useState } from "react";
import api from "@/api";

// ---------- Types (aligned with your backend responses) ----------
type Product = {
  id: number;
  name: string;
  category_name?: string; // from SaleOut -> ProductOut (sale route schema)
};

type SaleItem = {
  quantity: number;
  unit_price: number;
  product: Product; // has id, name, category_name
};

type Sale = {
  id: number;
  created_at: string; // ISO
  sale_date?: string; // ISO (optional, prefer this for reporting when present)
  items: SaleItem[];
};

type POProduct = {
  id: number;
  name: string;
  // purchase order product includes a nested "category" in your schema,
  // but we only need id for cost basis here
};

type PurchaseItem = {
  quantity: number;
  unit_cost: number;
  product: POProduct;
};

type PurchaseOrder = {
  id: number;
  created_at: string; // ISO
  items: PurchaseItem[];
};

// ---------- UI Helpers ----------
const yearsFromData = (sales: Sale[], purchases: PurchaseOrder[]): number[] => {
  const set = new Set<number>();
  for (const s of sales) {
    const d = new Date(s.sale_date ?? s.created_at);
    if (!Number.isNaN(d.getTime())) set.add(d.getFullYear());
  }
  for (const p of purchases) {
    const d = new Date(p.created_at);
    if (!Number.isNaN(d.getTime())) set.add(d.getFullYear());
  }
  // Ensure current year is present even if no data yet
  set.add(new Date().getFullYear());
  return Array.from(set).sort((a, b) => b - a);
};

const monthNames = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
] as const;

type CostBasisMode = "lifetime_avg" | "range_avg";

// ---------- Component ----------
const Analytics: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Controls
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [view, setView] = useState<"year_summary" | "monthly_breakdown">("year_summary");
  const [costBasisMode, setCostBasisMode] = useState<CostBasisMode>("lifetime_avg");
  const [showAllTime, setShowAllTime] = useState<boolean>(false); // quick “All time” switch

  useEffect(() => {
    const fetchAll = async () => {
      const [salesRes, purchaseRes] = await Promise.all([
        api.get(`${import.meta.env.VITE_API_URL}/sales/`),
        api.get(`${import.meta.env.VITE_API_URL}/purchase_orders/`),
      ]);
      setSales(salesRes.data);
      setPurchases(purchaseRes.data);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const allYears = useMemo(() => yearsFromData(sales, purchases), [sales, purchases]);

  // ---------- Date filtering ----------
  const periodFilter = (d: Date) => {
    if (showAllTime) return true;
    return d.getFullYear() === selectedYear;
  };

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const d = new Date(s.sale_date ?? s.created_at);
      return !Number.isNaN(d.getTime()) && periodFilter(d);
    });
  }, [sales, selectedYear, showAllTime]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const d = new Date(p.created_at);
      return !Number.isNaN(d.getTime()) && periodFilter(d);
    });
  }, [purchases, selectedYear, showAllTime]);

  // ---------- Cost basis (weighted average) ----------
  // lifetimeAvg up to end of selected period (or now if All time)
  const endOfPeriod = useMemo(() => {
    const end = showAllTime ? new Date(8640000000000000) /* max */ : new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    return end;
  }, [selectedYear, showAllTime]);

  // Compute weighted average cost *up to endOfPeriod*
  const lifetimeAvgCostByProduct = useMemo(() => {
    const totalUnits: Record<number, number> = {};
    const totalCost: Record<number, number> = {};
    for (const po of purchases) {
      const pd = new Date(po.created_at);
      if (Number.isNaN(pd.getTime()) || pd > endOfPeriod) continue;
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
  }, [purchases, endOfPeriod]);

  // Range-only weighted average (restricted to filteredPurchases)
  const rangeAvgCostByProduct = useMemo(() => {
    const totalUnits: Record<number, number> = {};
    const totalCost: Record<number, number> = {};
    for (const po of filteredPurchases) {
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
  }, [filteredPurchases]);

  const avgCost = costBasisMode === "lifetime_avg" ? lifetimeAvgCostByProduct : rangeAvgCostByProduct;

  // ---------- Core metrics for current period ----------
  const {
    revenue,
    cogs,
    netProfit,
    totalUnitsSold,
    distinctProductsSold,
    revenueByCategory,
    productRows
  } = useMemo(() => {
    let revenue = 0;
    let cogs = 0;

    const revenueByCategory: Record<string, number> = {};
    const productAgg: Record<number, {
      id: number;
      name: string;
      category: string;
      unitsSold: number;
      revenue: number;
      cost: number;
      profit: number;
    }> = {};

    const productIdsSold = new Set<number>();
    let totalUnitsSold = 0;

    for (const s of filteredSales) {
      for (const it of s.items) {
        const id = it.product.id;
        const q  = it.quantity;
        const itemRevenue = q * it.unit_price;
        const itemCost    = q * (avgCost[id] || 0);
        const cat = it.product.category_name || "Uncategorized";

        revenue += itemRevenue;
        cogs    += itemCost;

        totalUnitsSold += q;
        productIdsSold.add(id);

        revenueByCategory[cat] = (revenueByCategory[cat] || 0) + itemRevenue;

        const row = productAgg[id] || {
          id,
          name: it.product.name,
          category: cat,
          unitsSold: 0,
          revenue: 0,
          cost: 0,
          profit: 0
        };
        row.unitsSold += q;
        row.revenue   += itemRevenue;
        row.cost      += itemCost;
        row.profit     = row.revenue - row.cost;
        productAgg[id] = row;
      }
    }

    const productRows = Object.values(productAgg).sort((a, b) => b.profit - a.profit);

    return {
      revenue,
      cogs,
      netProfit: revenue - cogs,
      totalUnitsSold,
      distinctProductsSold: productIdsSold.size,
      revenueByCategory,
      productRows
    };
  }, [filteredSales, avgCost]);

  // ---------- Monthly breakdown for selected year ----------
  const monthly = useMemo(() => {
    // 12 months, zero-init
    const rows = Array.from({ length: 12 }).map((_, m) => ({
      monthIndex: m,
      month: monthNames[m],
      revenue: 0,
      cost: 0,
      profit: 0,
      unitsSold: 0,
      saleOrders: 0
    }));

    for (const s of sales) {
      const d = new Date(s.sale_date ?? s.created_at);
      if (Number.isNaN(d.getTime())) continue;
      if (!(showAllTime || d.getFullYear() === selectedYear)) continue;

      // count orders once per sale
      const mIdx = d.getMonth();
      rows[mIdx].saleOrders += 1;

      // sum items
      for (const it of s.items) {
        const id = it.product.id;
        const q  = it.quantity;
        const rev = q * it.unit_price;
        const cost = q * (avgCost[id] || 0);
        rows[mIdx].revenue   += rev;
        rows[mIdx].cost      += cost;
        rows[mIdx].profit     = rows[mIdx].revenue - rows[mIdx].cost;
        rows[mIdx].unitsSold += q;
      }
    }

    return rows;
  }, [sales, avgCost, selectedYear, showAllTime]);

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">📈 Analytics</h1>
          <p className="text-gray-600">Profit-first view of your business with yearly and monthly rollups.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold">Year</label>
            <select
              disabled={showAllTime}
              className="border rounded px-3 py-2"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {allYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold">View</label>
            <select
              className="border rounded px-3 py-2"
              value={view}
              onChange={(e) => setView(e.target.value as any)}
            >
              <option value="year_summary">Year summary</option>
              <option value="monthly_breakdown">Monthly breakdown</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold">Cost basis</label>
            <select
              className="border rounded px-3 py-2"
              value={costBasisMode}
              onChange={(e) => setCostBasisMode(e.target.value as CostBasisMode)}
              title="Weighted average of purchase costs"
            >
              <option value="lifetime_avg">Weighted Avg (up to period)</option>
              <option value="range_avg">Weighted Avg (in range)</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={showAllTime}
              onChange={(e) => setShowAllTime(e.target.checked)}
            />
            All time
          </label>
        </div>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI title="Revenue" value={revenue} format="currency" accent="text-emerald-700" />
        <KPI title="COGS" value={cogs} format="currency" accent="text-rose-700" />
        <KPI title="Net Profit" value={netProfit} format="currency" accent="text-blue-700" />
        <div className="grid grid-cols-2 gap-4">
          <KPI title="Units Sold" value={totalUnitsSold} />
          <KPI title="Distinct Products" value={distinctProductsSold} />
        </div>
      </section>

      {/* Year Summary */}
      {view === "year_summary" && (
        <>
          <section className="bg-white rounded-xl shadow p-5">
            <h2 className="text-lg font-semibold mb-3">Revenue by Category</h2>
            <div className="divide-y">
              {Object.entries(revenueByCategory)
                .sort((a,b) => b[1] - a[1])
                .map(([cat, val]) => (
                <div key={cat} className="flex items-center justify-between py-2">
                  <span className="font-medium">{cat}</span>
                  <span className="tabular-nums">${val.toFixed(2)}</span>
                </div>
              ))}
              {Object.keys(revenueByCategory).length === 0 && (
                <p className="text-gray-500">No sales recorded for this period.</p>
              )}
            </div>
          </section>

          <section className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Product Profitability</h2>
              <span className="text-sm text-gray-500">
                Sorted by profit (using {costBasisMode === "lifetime_avg" ? "lifetime" : "range"} average cost)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left bg-gray-50">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-right">Units</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                    <th className="px-3 py-2 text-right">COGS</th>
                    <th className="px-3 py-2 text-right">Profit</th>
                    <th className="px-3 py-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((r) => {
                    const margin = r.revenue > 0 ? (r.profit / r.revenue) : 0;
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2">{r.category}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.unitsSold}</td>
                        <td className="px-3 py-2 text-right tabular-nums">${r.revenue.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">${r.cost.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">${r.profit.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{(margin * 100).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                  {productRows.length === 0 && (
                    <tr><td className="px-3 py-3 text-gray-500" colSpan={7}>No products sold in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Monthly breakdown */}
      {view === "monthly_breakdown" && (
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Monthly Breakdown — {showAllTime ? "All Time" : selectedYear}</h2>
            <span className="text-sm text-gray-500">
              Each month shows totals based on your current cost-basis mode.
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left bg-gray-50">
                <tr>
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2 text-right">Orders</th>
                  <th className="px-3 py-2 text-right">Units</th>
                  <th className="px-3 py-2 text-right">Revenue</th>
                  <th className="px-3 py-2 text-right">COGS</th>
                  <th className="px-3 py-2 text-right">Profit</th>
                  <th className="px-3 py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => {
                  const margin = m.revenue > 0 ? (m.profit / m.revenue) : 0;
                  return (
                    <tr key={m.monthIndex} className="border-t">
                      <td className="px-3 py-2 font-medium">{m.month}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.saleOrders}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.unitsSold}</td>
                      <td className="px-3 py-2 text-right tabular-nums">${m.revenue.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">${m.cost.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">${m.profit.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{(margin * 100).toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t">
                {(() => {
                  const tRev = monthly.reduce((a,b)=>a+b.revenue,0);
                  const tCost = monthly.reduce((a,b)=>a+b.cost,0);
                  const tProfit = tRev - tCost;
                  const tUnits = monthly.reduce((a,b)=>a+b.unitsSold,0);
                  const tOrders = monthly.reduce((a,b)=>a+b.saleOrders,0);
                  const tMargin = tRev > 0 ? (tProfit/tRev) : 0;
                  return (
                    <tr>
                      <th className="px-3 py-2 text-right">Totals</th>
                      <th className="px-3 py-2 text-right tabular-nums">{tOrders}</th>
                      <th className="px-3 py-2 text-right tabular-nums">{tUnits}</th>
                      <th className="px-3 py-2 text-right tabular-nums">${tRev.toFixed(2)}</th>
                      <th className="px-3 py-2 text-right tabular-nums">${tCost.toFixed(2)}</th>
                      <th className="px-3 py-2 text-right tabular-nums font-semibold">${tProfit.toFixed(2)}</th>
                      <th className="px-3 py-2 text-right tabular-nums">{(tMargin*100).toFixed(1)}%</th>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Footnote / tips */}
      <p className="text-xs text-gray-500">
        Tip: “Weighted Avg (lifetime)” uses all purchase orders through the end of the selected period to cost sales (helps when you entered past restocks earlier). 
        Switch to “in range” if you specifically want to isolate the period’s purchases only.
      </p>
    </div>
  );
};

// ---------- Small KPI card ----------
const KPI: React.FC<{
  title: string;
  value: number;
  format?: "currency" | "number";
  accent?: string;
}> = ({ title, value, format = "number", accent = "text-gray-800" }) => {
  const text = format === "currency" ? `$${value.toFixed(2)}` : value.toLocaleString();
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="text-gray-600 text-sm">{title}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{text}</div>
    </div>
  );
};

export default Analytics;
