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
  items: SaleItem[];
  notes?: string;
  type_of_sale?: string;
}

const SaleDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sale, setSale] = useState<Sale | null>(null);

  useEffect(() => {
    const fetchSale = async () => {
      const res = await fetch(`http://127.0.0.1:8000/sales/${id}`);
      const data = await res.json();
      setSale(data);
    };
    fetchSale();
  }, [id]);

  if (!sale) return <div className="p-4">Loading sale...</div>;

  const total = sale.items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-1">Sale #{sale.id}</h1>
      <p className="text-sm text-gray-600 mb-1">
        Date: {new Date(sale.created_at).toLocaleString()}
      </p>
      {sale.type_of_sale && (
        <p className="text-sm text-gray-600 mb-1">
          Type of Sale: <span className="font-medium">{sale.type_of_sale}</span>
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
          {sale.items.map((item) => (
            <tr key={item.id}>
              <td className="border px-4 py-2">{item.product.name}</td>
              <td className="border px-4 py-2 text-right">{item.quantity}</td>
              <td className="border px-4 py-2 text-right">${item.unit_price.toFixed(2)}</td>
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

      <button
        onClick={() => navigate("/sales")}
        className="px-4 py-2 border rounded hover:bg-gray-100"
      >
        ← Back to Sales
      </button>
    </div>
  );
};

export default SaleDetails;
