// src/components/AddProductForm.tsx
import React, { useState } from "react";
import axios from "axios";

interface AddProductFormProps {
  closeForm?: () => void;
}

const AddProductForm: React.FC<AddProductFormProps> = ({ closeForm }) => {
  const [name, setName] = useState("");
  const [unitCost, setUnitCost] = useState(0);
  const [reorderThreshold, setReorderThreshold] = useState(0);
  const [storageSpace, setStorageSpace] = useState(0);
  const [vendorId, setVendorId] = useState(1);
  const [quantityInStock, setQuantityInStock] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newProduct = {
      name,
      unit_cost: unitCost,
      reorder_threshold: reorderThreshold,
      storage_space: storageSpace,
      vendor_id: vendorId,
      quantity_in_stock: quantityInStock,
    };

    try {
      const response = await axios.post("http://localhost:8000/products/", newProduct);
      console.log("Product created:", response.data);
      setMessage("Product added successfully!");
      setName("");
      setUnitCost(0);
      setReorderThreshold(0);
      setStorageSpace(0);
      setQuantityInStock(0);
      closeForm?.();
    } catch (error) {
      console.error("There was an error creating the product:", error);
      setMessage("There was an error adding the product. Please try again.");
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-bold">Add New Product</h2>
        {message && <p className="text-center text-lg font-semibold">{message}</p>}
        <div>
          <label htmlFor="name" className="block text-sm font-medium">Product Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label htmlFor="unitCost" className="block text-sm font-medium">Unit Cost</label>
          <input
            id="unitCost"
            type="number"
            value={unitCost}
            onChange={(e) => setUnitCost(Number(e.target.value))}
            required
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label htmlFor="reorderThreshold" className="block text-sm font-medium">Reorder Threshold</label>
          <input
            id="reorderThreshold"
            type="number"
            value={reorderThreshold}
            onChange={(e) => setReorderThreshold(Number(e.target.value))}
            required
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label htmlFor="storageSpace" className="block text-sm font-medium">Storage Space</label>
          <input
            id="storageSpace"
            type="number"
            value={storageSpace}
            onChange={(e) => setStorageSpace(Number(e.target.value))}
            required
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label htmlFor="quantityInStock" className="block text-sm font-medium">Quantity in Stock</label>
          <input
            id="quantityInStock"
            type="number"
            value={quantityInStock}
            onChange={(e) => setQuantityInStock(Number(e.target.value))}
            required
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <button
            type="submit"
            className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-700"
          >
            Add Product
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddProductForm;
