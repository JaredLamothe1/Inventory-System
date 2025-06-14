import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const PurchaseOrdersPage = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios.get('${import.meta.env.VITE_API_URL}/purchase_orders/')
      .then((res) => {
        setOrders(res.data || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Error fetching purchase orders');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-6">Loading purchase orders...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Purchase Orders</h1>
        <Link
          to="/add-purchase-order"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add New Order
        </Link>
      </div>

      {orders.length === 0 ? (
        <p>No purchase orders found.</p>
      ) : (
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="border px-4 py-2">Order ID</th>
              <th className="border px-4 py-2">Date</th>
              <th className="border px-4 py-2"># of Items</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="border px-4 py-2">
                    <Link
                      to={`/purchase-orders/${order.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {order.id}
                    </Link>
                  </td>
                <td className="border px-4 py-2">{new Date(order.created_at).toLocaleDateString()}</td>
                <td className="border px-4 py-2">{order.items.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PurchaseOrdersPage;
