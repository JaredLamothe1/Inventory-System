import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Product {
  id: number;
  name: string;
}

interface SaleItem {
  id: number;
  quantity: number;
  unit_price: number;
  product: Product;
}

interface Sale {
  id: number;
  created_at: string;
  sale_date?: string;
  sale_type?: string;
  notes?: string;
  items: SaleItem[];
  virtualOrderNumber?: number;
}

const formatType = (type: string | undefined) => {
  if (!type) return "N/A";
  return type
    .replace("batch-daily", "Batch - Daily")
    .replace("batch-weekly", "Batch - Weekly")
    .replace("individual", "Individual")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const SalesPage = () => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    const fetchSales = async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sales/`);
      const data = await res.json();
      const sorted = data.sort((a: Sale, b: Sale) => {
        const dateA = new Date(a.sale_date ?? a.created_at);
        const dateB = new Date(b.sale_date ?? b.created_at);
        return dateA.getTime() - dateB.getTime();
      }).map((sale: Sale, index: number) => ({ ...sale, virtualOrderNumber: index + 1 }));
      setSales(sorted);
    };
    fetchSales();
  }, []);

  const filteredSales = sales.filter((sale) => {
    const matchSearch =
      sale.notes?.toLowerCase().includes(search.toLowerCase()) ||
      sale.items.some(item => item.product.name.toLowerCase().includes(search.toLowerCase()));
    const matchType = typeFilter ? sale.sale_type === typeFilter : true;
    const date = new Date(sale.sale_date ?? sale.created_at).toISOString().split("T")[0];
    const matchStart = startDate ? date >= startDate : true;
    const matchEnd = endDate ? date <= endDate : true;
    return matchSearch && matchType && matchStart && matchEnd;
  });

  const paginated = filteredSales.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(filteredSales.length / perPage);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Sales</h1>
        <Link
          to="/sales/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + New Sale
        </Link>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-4">Search and Filter Sales</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Search notes or product names"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-3 py-2 rounded"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border px-3 py-2 rounded"
          >
            <option value="">All Types</option>
            <option value="individual">Individual</option>
            <option value="batch-daily">Daily Summary</option>
            <option value="batch-weekly">Weekly Summary</option>
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border px-3 py-2 rounded"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border px-3 py-2 rounded"
          />
          <button
            onClick={() => {
              setSearch("");
              setTypeFilter("");
              setStartDate("");
              setEndDate("");
            }}
            className="bg-gray-300 hover:bg-gray-400 px-3 py-2 rounded"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {paginated.length === 0 ? (
        <p className="text-gray-500">No sales match your filters.</p>
      ) : (
        <>
          <div className="space-y-4">
            {paginated.map((sale) => {
              const total = sale.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
              const itemCount = sale.items.reduce((sum, item) => sum + item.quantity, 0);
              return (
                <div
                  key={sale.id}
                  className="border rounded p-4 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => setExpanded((prev) => ({ ...prev, [sale.id]: !prev[sale.id] }))}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-lg">
                      Sale #{sale.virtualOrderNumber ?? sale.id}
                    </span>
                    <span className="text-sm text-gray-500">
                      {sale.sale_date
                        ? new Date(sale.sale_date).toLocaleDateString()
                        : new Date(sale.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    <strong>Type:</strong> {formatType(sale.sale_type)}
                  </div>
                  {sale.notes && (
                    <div className="text-sm text-gray-700">
                      <strong>Notes:</strong> {sale.notes}
                    </div>
                  )}
                  <div className="mt-1 text-sm text-gray-800">
                    {itemCount} item{itemCount !== 1 && "s"} — <span className="font-bold">${total.toFixed(2)}</span>
                  </div>
                  {expanded[sale.id] && (
                    <div className="mt-3 text-sm text-gray-600 border-t pt-2 space-y-1">
                      {sale.items.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span>{item.product.name} x {item.quantity}</span>
                          <span>${(item.quantity * item.unit_price).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="mt-4 text-right">
                        <Link
                          to={`/sales/${sale.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          View Full Details →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`px-3 py-1 border rounded ${page === i + 1 ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SalesPage;
