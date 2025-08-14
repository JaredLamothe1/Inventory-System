import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

interface Product {
  id: number;
  name: string;
}

interface SaleItem {
  id: number;
  product: Product;
  quantity: number;
  unit_price: number;
}

interface Sale {
  id: number;
  created_at: string;
  sale_date?: string;
  sale_type?: string;   // matches backend SaleOut
  notes?: string;
  items: SaleItem[];
}

const SaleDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchSale = async () => {
      try {
        setLoading(true);
        setErrMsg(null);
        const token = localStorage.getItem("token");
        if (!token) {
          setErrMsg("You must be logged in.");
          navigate("/login");
          return;
        }

        const res = await fetch(`${import.meta.env.VITE_API_URL}/sales/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          setErrMsg("Session expired. Please log in again.");
          navigate("/login");
          return;
        }
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to load sale ${id}: ${res.status} ${text}`);
        }

        const data = await res.json();
        setSale(data);
      } catch (e: any) {
        console.error(e);
        setErrMsg(e?.message || "Could not load this sale.");
      } finally {
        setLoading(false);
      }
    };

    fetchSale();
  }, [id, navigate]);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Delete this sale and return items to inventory?"
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/sales/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        navigate("/login");
        return;
      }

      if (res.ok) {
        alert("Sale deleted and inventory updated.");
        navigate("/sales");
      } else {
        const msg = await res.text();
        console.error("Delete failed:", msg);
        alert("Failed to delete sale.");
      }
    } catch (err) {
      console.error("Error deleting sale:", err);
      alert("Failed to delete sale.");
    }
  };

  const handleEdit = () => navigate(`/sales/edit/${id}`);

  if (loading) return <div className="p-4">Loading sale...</div>;
  if (errMsg) return <div className="p-4 text-red-600">{errMsg}</div>;
  if (!sale) return <div className="p-4">No sale found.</div>;

  const dateStr = sale.sale_date ?? sale.created_at;
  const when = new Date(dateStr);
  const displayDate = isNaN(when.getTime()) ? dateStr : when.toLocaleString();

  const total =
    sale.items?.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-1">Sale #{sale.id}</h1>
      <p className="text-sm text-gray-600 mb-1">Date: {displayDate}</p>
      {sale.sale_type && (
        <p className="text-sm text-gray-600 mb-1">
          Type of Sale: <span className="font-medium">{sale.sale_type}</span>
        </p>
      )}
      {sale.notes && (
        <p className="text-sm text-gray-600 mb-4 whitespace-pre-line">
          Notes: {sale.notes}
        </p>
      )}

      <table className="w-full border mb-6 text-base">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="border px-4 py-2">Product</th>
            <th className="border px-4 py-2 text-right">Quantity</th>
            <th className="border px-4 py-2 text-right">Unit Price</th>
            <th className="border px-4 py-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {(sale.items ?? []).map((item) => (
            <tr key={item.id}>
              <td className="border px-4 py-2">{item.product?.name ?? "—"}</td>
              <td className="border px-4 py-2 text-right">{item.quantity}</td>
              <td className="border px-4 py-2 text-right">
                ${item.unit_price.toFixed(2)}
              </td>
              <td className="border px-4 py-2 text-right">
                ${(item.quantity * item.unit_price).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-xl font-semibold text-right mb-4">
        Total: ${total.toFixed(2)}
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => navigate("/sales")}
          className="px-4 py-2 border rounded hover:bg-gray-100"
        >
          ← Back to Sales
        </button>

        <button
          onClick={handleEdit}
          className="px-4 py-2 border rounded bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
        >
          Edit Sale
        </button>

        <button
          onClick={handleDelete}
          className="px-4 py-2 border rounded bg-red-100 hover:bg-red-200 text-red-800"
        >
          Delete Sale
        </button>
      </div>
    </div>
  );
};

export default SaleDetails;
