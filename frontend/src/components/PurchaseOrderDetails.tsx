import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  category: Category;
}

interface PurchaseOrderItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_cost: number;
  product: Product;
}

interface PurchaseOrder {
  id: number;
  created_at: string;
  items: PurchaseOrderItem[];
}

const PurchaseOrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios.get(`https://inventory-system-xf8x.onrender.com/purchase_orders/${id}`)
      .then((res) => {
        setOrder(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not fetch purchase order.');
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!order) return null;

  // Group items by category
  const itemsByCategory: { [categoryName: string]: PurchaseOrderItem[] } = {};
  order.items.forEach(item => {
    const categoryName = item.product.category.name;
    if (!itemsByCategory[categoryName]) {
      itemsByCategory[categoryName] = [];
    }
    itemsByCategory[categoryName].push(item);
  });

  const total = order.items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Purchase Order #{order.id}</h1>
        <button
          className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded"
          onClick={() => navigate('/purchase-orders')}
        >
          Back
        </button>
      </div>

      <p className="text-md text-gray-600 mb-4">
        <strong>Date:</strong> {new Date(order.created_at).toLocaleDateString()}
      </p>

      {Object.entries(itemsByCategory).map(([category, items]) => {
  const categoryTotalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const unitCost = items[0]?.unit_cost || 0;

  return (
    <div key={category} className="mb-10">
      <h2 className="text-xl font-semibold border-b pb-1 mb-1">{category}</h2>
      <p className="text-sm text-gray-600 mb-2">
        Total Quantity: <strong>{categoryTotalQty}</strong> &nbsp;|&nbsp; Unit Cost: <strong>${unitCost.toFixed(2)}</strong>
      </p>

      <table className="min-w-full border text-base mb-4">
        <thead className="bg-gray-200 text-base">
          <tr>
            <th className="border px-4 py-2 text-left">Product</th>
            <th className="border px-4 py-2 text-right">Quantity</th>
            <th className="border px-4 py-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="border px-4 py-2">{item.product.name}</td>
              <td className="border px-4 py-2 text-right text-lg font-medium">{item.quantity}</td>
              <td className="border px-4 py-2 text-right text-lg font-medium">
                ${(item.quantity * item.unit_cost).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
})}



      <div className="text-right text-2xl font-bold pt-6 border-t">
        Total: ${total.toFixed(2)}
      </div>
    </div>
  );
};

export default PurchaseOrderDetails;
