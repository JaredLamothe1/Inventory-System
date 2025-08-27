// Analytics.tsx  (only change is the Product Profitability <tbody>)
import React, { useEffect, useMemo, useState } from "react";
import api from "@/api";

/** =========================
 *   Types matching API shape
 *  ========================= */
type Product = {
  id: number;
  name: string;
  category_name?: string | null;
};

type SaleItem = {
  quantity: number;
  unit_price: number;
  product?: Product | null;
  product_id?: number;
  product_name?: string;
  category_name?: string | null;
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
  product_id: number;
  product_name: string;
  category_name?: string | null;
};
type PurchaseOrder = {
  id: number;
  created_at: string;
  purchase_date?: string;
  order_date?: string;
  received_date?: string;

  shipping_cost: number;
  handling_cost: number;
  items_subtotal: number;
  grand_total: number;
  items: PurchaseItem[];
};

/** =========================
 *   Small helpers
 *  ========================= */
const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;
const toUSD = (n: number) => `$${(n ?? 0).toFixed(2)}`;

const safeDate = (v?: string) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const pickPODate = (po: PurchaseOrder) =>
  safeDate(po.purchase_date) ||
  safeDate(po.received_date) ||
  safeDate(po.order_date) ||
  safeDate(po.created_at) ||
  new Date(po.created_at || Date.now());

const yearsFromData = (sales: Sale[], purchases: PurchaseOrder[]) => {
  const set = new Set<number>();
  for (const s of sales) {
    const d = safeDate(s.sale_date) || safeDate(s.created_at);
    if (d) set.add(d.getFullYear());
  }
  for (const p of purchases) {
    const d = pickPODate(p);
    if (d) set.add(d.getFullYear());
  }
  set.add(new Date().getFullYear());
  return Array.from(set).sort((a, b) => b - a);
};

/** Allocate a PO’s shipping+handling across items (by cost; fallback to qty). */
function allocatePOExtras(po: PurchaseOrder): Record<number, number> {
  const extra = (Number(po.shipping_cost) || 0) + (Number(po.handling_cost) || 0);
  if (extra <= 0) return {};
  const costSum = po.items.reduce((s, it) => s + (it.quantity || 0) * (it.unit_cost || 0), 0);
  const qtySum  = po.items.reduce((s, it) => s + (it.quantity || 0), 0);

  const perItemExtra: Record<number, number> = {};
  if (costSum > 0) {
    po.items.forEach((it, idx) => {
      const share = ((it.quantity || 0) * (it.unit_cost || 0)) / costSum;
      perItemExtra[idx] = extra * share;
    });
  } else if (qtySum > 0) {
    po.items.forEach((it, idx) => {
      const share = (it.quantity || 0) / qtySum;
      perItemExtra[idx] = extra * share;
    });
  }
  return perItemExtra;
}

/** =========================
 *   Moving-average engine
 *  ========================= */
type ProductEvent =
  | { kind: "purchase"; date: Date; qty: number; unitCostEff: number }
  | { kind: "sale"; date: Date; saleId: number; qty: number; unitPrice: number; name: string; category: string };

function buildPerProductEvents(
  purchases: PurchaseOrder[],
  sales: Sale[]
): Map<number, ProductEvent[]> {
  const map = new Map<number, ProductEvent[]>();

  // Purchases
  for (const po of purchases) {
    const d = pickPODate(po);
    if (!d) continue;
    const extras = allocatePOExtras(po);
    po.items.forEach((it, idx) => {
      const pid = it.product_id;
      const qty = it.quantity || 0;
      if (!pid || qty <= 0) return;

      const allocExtra = Number(extras[idx] || 0);
      const perUnitExtra = qty > 0 ? allocExtra / qty : 0;
      const unitCostEff = (it.unit_cost || 0) + perUnitExtra;

      const arr = map.get(pid) || [];
      arr.push({ kind: "purchase", date: d, qty, unitCostEff });
      map.set(pid, arr);
    });
  }

  // Sales
  for (const s of sales) {
    const d = safeDate(s.sale_date) || safeDate(s.created_at);
    if (!d) continue;
    for (const it of s.items) {
      const pid = it.product?.id ?? it.product_id;
      const qty = it.quantity || 0;
      if (!pid || qty <= 0) continue;

      const name = it.product?.name ?? it.product_name ?? `Product ${pid}`;
      const category = it.product?.category_name ?? it.category_name ?? "Uncategorized";
      const unitPrice = it.unit_price || 0;

      const arr = map.get(pid) || [];
      arr.push({ kind: "sale", date: d, saleId: s.id, qty, unitPrice, name, category });
      map.set(pid, arr);
    }
  }

  // Sort each product's events by date
  for (const [pid, arr] of map.entries()) {
    arr.sort((a, b) => {
      const ta = +a.date, tb = +b.date;
      if (ta !== tb) return ta - tb;
      if (a.kind === b.kind) return 0;
      return a.kind === "purchase" ? -1 : 1;
    });
  }

  return map;
}

/** =========================
 *   Component
 *  ========================= */
const Analytics: React.FC = () => {
  // Raw data
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Controls
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showAllTime, setShowAllTime] = useState(false);
  const [view, setView] = useState<"year_summary" | "monthly_breakdown">("year_summary");

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [salesRes, poRes] = await Promise.all([
          api.get("/sales/"),
          api.get("/purchase_orders/"),
        ]);
        setSales(Array.isArray(salesRes.data) ? salesRes.data : []);
        setPurchases(Array.isArray(poRes.data) ? poRes.data : []);
      } catch (e) {
        console.error("Analytics fetch error:", e);
        setSales([]);
        setPurchases([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // ===== Global average fallback =====
  const globalAvgCost: Record<number, number> = useMemo(() => {
    const units: Record<number, number> = {};
    const cost: Record<number, number> = {};
    for (const po of purchases) {
      const extras = allocatePOExtras(po);
      po.items.forEach((it, idx) => {
        const pid = it.product_id;
        const qty = it.quantity || 0;
        if (!pid || qty <= 0) return;
        const allocExtra = Number(extras[idx] || 0);
        const eff = (it.unit_cost || 0) + (qty > 0 ? allocExtra / qty : 0);
        units[pid] = (units[pid] || 0) + qty;
        cost[pid]  = (cost[pid]  || 0) + qty * eff;
      });
    }
    const avg: Record<number, number> = {};
    for (const k of Object.keys(units)) {
      const pid = Number(k);
      avg[pid] = units[pid] ? cost[pid] / units[pid] : 0;
    }
    return avg;
  }, [purchases]);

  const allYears = useMemo(() => yearsFromData(sales, purchases), [sales, purchases]);

  // Range
  const startOfPeriod = showAllTime ? new Date(-8640000000000000) : new Date(selectedYear, 0, 1);
  const endOfPeriod   = showAllTime ? new Date( 8640000000000000) : new Date(selectedYear, 11, 31, 23, 59, 59, 999);

  // Build events across all history
  const perProductEvents = useMemo(() => buildPerProductEvents(purchases, sales), [purchases, sales]);

  /** Run the simulation. */
  const sim = useMemo(() => {
    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalUnitsSold = 0;
    const productRows: {
      id: number; name: string; category: string;
      unitsSold: number; revenue: number; cost: number; profit: number;
    }[] = [];
    const perProductAgg = new Map<number, (typeof productRows)[number]>();
    const revenueByCategory: Record<string, number> = {};

    // For inventory snapshot (as of endOfPeriod)
    const onHandAtEnd: Record<number, number> = {};
    const avgCostAtEnd: Record<number, number> = {};
    const nameMemo: Record<number, { name: string; category: string }> = {};

    for (const [pid, events] of perProductEvents.entries()) {
      let onHand = 0;
      let wac = 0; // moving average unit cost
      let inventoryValue = 0; // onHand * wac

      for (const ev of events) {
        if (ev.kind === "purchase") {
          const addCost = ev.qty * ev.unitCostEff;
          onHand += ev.qty;
          inventoryValue += addCost;
          wac = onHand > 0 ? (inventoryValue / onHand) : 0;
        } else {
          nameMemo[pid] = { name: ev.name, category: ev.category };

          let cogs = ev.qty * wac;
          if (cogs === 0 && (globalAvgCost[pid] ?? 0) > 0) {
            cogs = ev.qty * globalAvgCost[pid];
          }
          const rev  = ev.qty * ev.unitPrice;

          if (ev.date >= startOfPeriod && ev.date <= endOfPeriod) {
            totalRevenue += rev;
            totalCOGS    += cogs;
            totalUnitsSold += ev.qty;

            revenueByCategory[ev.category] = (revenueByCategory[ev.category] || 0) + rev;

            const row = perProductAgg.get(pid) || {
              id: pid, name: ev.name, category: ev.category,
              unitsSold: 0, revenue: 0, cost: 0, profit: 0
            };
            row.unitsSold += ev.qty;
            row.revenue   += rev;
            row.cost      += cogs;
            row.profit     = row.revenue - row.cost;
            perProductAgg.set(pid, row);
          }

          // reduce inventory
          onHand -= ev.qty;
          if (onHand < 0) onHand = 0;
          inventoryValue -= cogs;
          if (inventoryValue < 0) inventoryValue = 0;
          wac = onHand > 0 ? (inventoryValue / onHand) : 0;
        }
      }

      // Snapshot as of endOfPeriod
      let oh = 0, val = 0, wa = 0;
      for (const ev of events) {
        if (ev.date > endOfPeriod) break;
        if (ev.kind === "purchase") {
          oh += ev.qty;
          val += ev.qty * ev.unitCostEff;
          wa = oh > 0 ? (val / oh) : 0;
        } else {
          const c = ev.qty * wa;
          oh -= ev.qty; if (oh < 0) oh = 0;
          val -= c;     if (val < 0) val = 0;
          wa = oh > 0 ? (val / oh) : 0;
        }
      }
      onHandAtEnd[pid] = oh;
      avgCostAtEnd[pid] = wa;
    }

    for (const row of perProductAgg.values()) productRows.push(row);
    productRows.sort((a, b) => b.profit - a.profit);

    const invRows: { id: number; name: string; category: string; onHand: number; unitCost: number; value: number }[] = [];
    let invUnits = 0, invValue = 0;
    for (const pidStr of Object.keys(onHandAtEnd)) {
      const pid = Number(pidStr);
      const oh = onHandAtEnd[pid] || 0;
      if (oh <= 0) continue;
      const unitCost = avgCostAtEnd[pid] || 0;
      const value = oh * unitCost;
      const meta = nameMemo[pid] || { name: `Product ${pid}`, category: "Uncategorized" };
      invRows.push({ id: pid, name: meta.name, category: meta.category, onHand: oh, unitCost, value });
      invUnits += oh;
      invValue += value;
    }
    invRows.sort((a, b) => b.value - a.value);

    return {
      revenue: totalRevenue,
      cogs: totalCOGS,
      profit: totalRevenue - totalCOGS,
      totalUnitsSold,
      productRows,
      revenueByCategory,
      inventory: { rows: invRows, totalUnits: invUnits, totalValue: invValue }
    };
  }, [perProductEvents, startOfPeriod, endOfPeriod, globalAvgCost]);

  // Monthly breakdown
  const monthly = useMemo(() => {
    const rows = Array.from({ length: 12 }).map((_, m) => ({
      monthIndex: m, month: monthNames[m],
      saleOrders: 0, unitsSold: 0, revenue: 0, cost: 0, profit: 0
    }));

    const start = startOfPeriod, end = endOfPeriod;
    const perProd = perProductEvents;

    const perProdState = new Map<number, { onHand: number; wac: number }>();
    const merged: (ProductEvent & { pid: number })[] = [];
    for (const [pid, arr] of perProd.entries()) {
      for (const ev of arr) merged.push({ ...ev, pid });
    }
    merged.sort((a, b) => {
      const ta = +a.date, tb = +b.date;
      if (ta !== tb) return ta - tb;
      if (a.kind === b.kind) return 0;
      return a.kind === "purchase" ? -1 : 1;
    });

    for (const ev of merged) {
      const st = perProdState.get(ev.pid) || { onHand: 0, wac: 0 };
      if (ev.kind === "purchase") {
        const addCost = ev.qty * ev.unitCostEff;
        st.onHand += ev.qty;
        const invVal = st.wac * (st.onHand - ev.qty) + addCost;
        st.wac = st.onHand > 0 ? invVal / st.onHand : 0;
        perProdState.set(ev.pid, st);
      } else {
        let cogs = ev.qty * st.wac;
        if (cogs === 0 && (globalAvgCost[ev.pid] ?? 0) > 0) {
          cogs = ev.qty * globalAvgCost[ev.pid];
        }
        const rev = ev.qty * ev.unitPrice;

        if (ev.date >= start && ev.date <= end) {
          const mIdx = ev.date.getMonth();
          rows[mIdx].saleOrders += 1;
          rows[mIdx].unitsSold  += ev.qty;
          rows[mIdx].revenue    += rev;
          rows[mIdx].cost       += cogs;
          rows[mIdx].profit      = rows[mIdx].revenue - rows[mIdx].cost;
        }

        st.onHand -= ev.qty; if (st.onHand < 0) st.onHand = 0;
        if (st.onHand === 0) st.wac = 0;
        perProdState.set(ev.pid, st);
      }
    }

    return rows;
  }, [perProductEvents, startOfPeriod, endOfPeriod, globalAvgCost]);

  if (loading) return <div className="p-6">Loading…</div>;

  /** =========================
   *   UI
   *  ========================= */
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header & Controls */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">📈 Analytics</h1>
          <p className="text-gray-600">
            Moving-average COGS at the time of each sale (with safe fallback to global average if needed).
          </p>
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
              {yearsFromData(sales, purchases).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
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
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 italic">
              Purchases before the period still affect COGS via carryover inventory.
            </label>
          </div>
        </div>
      </header>

      {/* KPI Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI title="Revenue" value={monthly.reduce((a,m)=>a+m.revenue,0)} format="currency" accent="text-emerald-700" />
        <KPI title="COGS" value={monthly.reduce((a,m)=>a+m.cost,0)} format="currency" accent="text-rose-700" />
        <KPI title="Net Profit" value={monthly.reduce((a,m)=>a+m.profit,0)} format="currency" accent="text-blue-700" />
        <KPI title="Units Sold" value={monthly.reduce((a,m)=>a+m.unitsSold,0)} />
      </section>

      {/* Year Summary */}
      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="text-lg font-semibold mb-3">Product Profitability</h2>
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
              {sim.productRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                    No product sales in the selected period.
                  </td>
                </tr>
              ) : (
                sim.productRows.map((r) => {
                  const margin = r.revenue > 0 ? r.profit / r.revenue : 0;
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2">{r.category}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.unitsSold}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{toUSD(r.revenue)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{toUSD(r.cost)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{toUSD(r.profit)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{(margin * 100).toFixed(1)}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Monthly Breakdown */}
      <section className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Monthly Breakdown — {showAllTime ? "All Time" : selectedYear}
          </h2>
          <span className="text-sm text-gray-500">
            COGS uses moving-average at sale time; falls back to global avg only if no prior purchases exist.
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
              {monthly.map((m, idx) => {
                const margin = m.revenue > 0 ? (m.profit / m.revenue) : 0;
                return (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2 font-medium">{m.month}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.saleOrders}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.unitsSold}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{toUSD(m.revenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{toUSD(m.cost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{toUSD(m.profit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{(margin * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t">
              {(() => {
                const tRev    = monthly.reduce((a,b)=>a+b.revenue,0);
                const tCost   = monthly.reduce((a,b)=>a+b.cost,0);
                const tProfit = tRev - tCost;
                const tUnits  = monthly.reduce((a,b)=>a+b.unitsSold,0);
                const tOrders = monthly.reduce((a,b)=>a+b.saleOrders,0);
                const tMarg   = tRev > 0 ? (tProfit / tRev) : 0;
                return (
                  <tr>
                    <th className="px-3 py-2 text-right">Totals</th>
                    <th className="px-3 py-2 text-right tabular-nums">{tOrders}</th>
                    <th className="px-3 py-2 text-right tabular-nums">{tUnits}</th>
                    <th className="px-3 py-2 text-right tabular-nums">{toUSD(tRev)}</th>
                    <th className="px-3 py-2 text-right tabular-nums">{toUSD(tCost)}</th>
                    <th className="px-3 py-2 text-right tabular-nums font-semibold">{toUSD(tProfit)}</th>
                    <th className="px-3 py-2 text-right tabular-nums">{(tMarg * 100).toFixed(1)}%</th>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
};

/** KPI card */
const KPI: React.FC<{ title: string; value: number; format?: "currency" | "number"; accent?: string; }> = ({ title, value, format = "number", accent = "text-gray-800" }) => {
  const text = format === "currency" ? toUSD(value) : value.toLocaleString();
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="text-gray-600 text-sm">{title}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{text}</div>
    </div>
  );
};

export default Analytics;
