import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const AddPurchaseOrderForm = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<{ [key: number]: number }>({});
  const [orderDate, setOrderDate] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryNames, setCategoryNames] = useState<Record<number, string>>({});
  const [categoryPriceTiers, setCategoryPriceTiers] = useState<Record<number, { min_qty: number, price: number }[]>>({});
  const [categoryQuantities, setCategoryQuantities] = useState<Record<number, number>>({});

  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/products/`, {
      params: { page: 0, limit: 1000, sort_by: 'name', order: 'asc' }
    }).then((res) => {
      setProducts(res.data.products || []);
    });

    axios.get(`${import.meta.env.VITE_API_URL}/categories/`).then((res) => {
      const sorted = res.data.sort((a: any, b: any) => a.name.localeCompare(b.name));
      const nameMap: Record<number, string> = {};
      const tierMap: Record<number, { min_qty: number, price: number }[]> = {};

      sorted.forEach((cat: any) => {
        nameMap[cat.id] = cat.name;
        tierMap[cat.id] = cat.price_tiers || [];
      });

      setCategoryNames(nameMap);
      setCategoryPriceTiers(tierMap);
      setSelectedCategoryId(sorted[0]?.id ?? null);
    });
  }, []);

  const updateQuantity = (productId: number, quantity: number) => {
    setOrderItems((prev) => {
      const updated = { ...prev, [productId]: quantity };
      const newTotals: Record<number, number> = {};

      for (const p of products) {
        const q = updated[p.id] || 0;
        newTotals[p.category_id] = (newTotals[p.category_id] || 0) + q;
      }

      setCategoryQuantities(newTotals);
      return updated;
    });
  };

  const getCategoryUnitPrice = (categoryId: number): number => {
    const qty = categoryQuantities[categoryId] || 0;
    const tiers = categoryPriceTiers[categoryId] || [];
    let price = 0;
    for (const tier of tiers) {
      if (qty >= tier.min_qty) {
        price = tier.price;
      }
    }
    return price;
  };

  const getNextTierInfo = (categoryId: number) => {
    const qty = categoryQuantities[categoryId] || 0;
    const tiers = [...(categoryPriceTiers[categoryId] || [])].sort((a, b) => a.min_qty - b.min_qty);
    for (const tier of tiers) {
      if (qty < tier.min_qty) {
        return { needed: tier.min_qty - qty, nextPrice: tier.price, nextQty: tier.min_qty };
      }
    }
    return null;
  };

  const totalCost = Object.entries(orderItems).reduce((sum, [id, qty]) => {
    const product = products.find(p => p.id === Number(id));
    if (!product) return sum;
    const unit = getCategoryUnitPrice(product.category_id);
    return sum + (unit * qty);
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const items = Object.entries(orderItems)
      .filter(([_, quantity]) => quantity > 0)
      .map(([id, quantity]) => {
        const product = products.find(p => p.id === Number(id));
        const unit_cost = product ? getCategoryUnitPrice(product.category_id) : 0;
        return {
          product_id: Number(id),
          quantity,
          unit_cost
        };
      });

    if (!orderDate || items.length === 0) {
      setErrorMessage('Please select at least one product and date.');
      return;
    }

    axios.post('https://inventory-system-xf8x.onrender.com/purchase_orders/', {
      created_at: orderDate,
      items
    }).then(() => {
      navigate('/purchase-orders');
    }).catch(() => {
      setErrorMessage('Failed to create purchase order.');
    });
  };

  const visibleProducts = selectedCategoryId === null
    ? products
    : products.filter(p => p.category_id === selectedCategoryId);

  const currentPrice = selectedCategoryId ? getCategoryUnitPrice(selectedCategoryId) : 0;
  const tierProgress = selectedCategoryId ? getNextTierInfo(selectedCategoryId) : null;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Create Purchase Order</h2>
      {errorMessage && <div className="text-red-600 bg-red-100 p-3 rounded mb-4">{errorMessage}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Order Date</label>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="border p-2 w-full rounded"
            required
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {Object.keys(categoryNames).map((id) => (
            <button
              key={id}
              type="button"
              className={`px-4 py-2 rounded ${selectedCategoryId === Number(id) ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setSelectedCategoryId(Number(id))}
            >
              {categoryNames[Number(id)]}
            </button>
          ))}
        </div>

        {selectedCategoryId && (
          <div className="mb-4">
            <p className="font-semibold text-lg">💰 Price: ${currentPrice.toFixed(2)} per unit</p>
            {tierProgress && (
              <p className="text-sm text-gray-600">
                📈 {categoryQuantities[selectedCategoryId] || 0}/{tierProgress.nextQty} units — {tierProgress.needed} more to reach ${tierProgress.nextPrice.toFixed(2)}/unit
              </p>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="border px-4 py-2 text-left">Product</th>
                <th className="border px-4 py-2 text-left">Quantity</th>
                <th className="border px-4 py-2 text-left">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => {
                const qty = orderItems[product.id] || 0;
                const subtotal = qty * currentPrice;
                return (
                  <tr key={product.id}>
                    <td className="border px-4 py-2">{product.name}</td>
                    <td className="border px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        value={qty}
                        onChange={(e) => updateQuantity(product.id, Number(e.target.value))}
                        className="p-1 border rounded w-20"
                      />
                    </td>
                    <td className="border px-4 py-2">${subtotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-right text-lg font-semibold pt-4">Total: ${totalCost.toFixed(2)}</div>

        <div className="flex justify-between gap-4 mt-6">
          <button
            type="button"
            className="w-1/2 bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded"
            onClick={() => navigate('/purchase-orders')}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Submit Purchase Order
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddPurchaseOrderForm;
