import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Pencil, Check, X } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  unit_cost: number;
  reorder_threshold: number;
  storage_space: number | null;
  vendor_id: number | null;
  quantity_in_stock: number;
}

const ProductDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Product | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingStock, setEditingStock] = useState(false);
  const [stockInput, setStockInput] = useState<number>(0);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/products/${id}`).then(res => {
      setProduct(res.data);
      setFormData(res.data);
      setStockInput(res.data.quantity_in_stock);
    });
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (formData) {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const handleSave = () => {
    axios.put(`${import.meta.env.VITE_API_URL}/products/${id}`, formData).then(res => {
      setProduct(res.data);
      setEditMode(false);
    });
  };

  const handleDelete = () => {
    axios.delete(`${import.meta.env.VITE_API_URL}/products/${id}`).then(() => {
      navigate('/products');
    });
  };

  const handleQuickStockUpdate = () => {
    if (!product) return;
    axios.put(`${import.meta.env.VITE_API_URL}/products/${product.id}`, {
      ...product,
      quantity_in_stock: stockInput,
    }).then(res => {
      setProduct(res.data);
      setStockInput(res.data.quantity_in_stock);
      setEditingStock(false);
    });
  };

  const handleStockKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleQuickStockUpdate();
    }
  };

  if (!product || !formData) return <div className="p-6">Loading...</div>;

  const totalValue = (product.unit_cost * product.quantity_in_stock).toFixed(2);
  const needsRestock = product.quantity_in_stock < product.reorder_threshold;

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-lg shadow-xl">
      <button
        onClick={() => navigate('/products')}
        className="text-blue-600 hover:underline mb-4"
      >
        ← Back to Products
      </button>

      <h1 className="text-3xl font-bold mb-4">{product.name}</h1>

      <div className="space-y-3">
        {editMode ? (
          <>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              placeholder="Product Name"
            />
            <input
              name="unit_cost"
              type="number"
              value={formData.unit_cost}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              placeholder="Unit Cost"
            />
            <input
              name="reorder_threshold"
              type="number"
              value={formData.reorder_threshold}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              placeholder="Reorder Threshold"
            />
            <input
              name="storage_space"
              type="number"
              value={formData.storage_space || ''}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              placeholder="Storage Space"
            />
            <input
              name="vendor_id"
              type="number"
              value={formData.vendor_id || ''}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              placeholder="Vendor ID"
            />
          </>
        ) : (
          <>
            <p><strong>Unit Cost:</strong> ${product.unit_cost}</p>
            <p><strong>Quantity in Stock:</strong> {editingStock ? (
              <span className="inline-flex items-center gap-2">
                <input
                  type="number"
                  value={stockInput}
                  onChange={(e) => setStockInput(Number(e.target.value))}
                  onKeyDown={handleStockKeyDown}
                  className="border p-1 rounded w-20"
                />
                <button onClick={handleQuickStockUpdate}><Check className="w-5 h-5 text-green-600" /></button>
                <button onClick={() => setEditingStock(false)}><X className="w-5 h-5 text-gray-500" /></button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                {product.quantity_in_stock}
                <button onClick={() => setEditingStock(true)}><Pencil className="w-4 h-4 text-blue-600" /></button>
              </span>
            )}</p>
            <p><strong>Reorder Threshold:</strong> {product.reorder_threshold}</p>
            <p><strong>Storage Space:</strong> {product.storage_space ?? 'N/A'}</p>
            <p><strong>Vendor ID:</strong> {product.vendor_id ?? 'N/A'}</p>
            <p><strong>Total Value:</strong> ${totalValue}</p>
            <p><strong>Restock Needed:</strong> {needsRestock ? 'Yes' : 'No'}</p>
          </>
        )}
      </div>

      <div className="mt-6 flex gap-4">
        {editMode ? (
          <>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditMode(false);
                setFormData(product);
              }}
              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Edit All Fields
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
          </>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="mt-4 p-4 bg-red-100 rounded border border-red-300">
          <p className="mb-3 text-red-800 font-semibold">Are you sure you want to delete this product?</p>
          <div className="flex gap-4">
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Yes, delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetails;
