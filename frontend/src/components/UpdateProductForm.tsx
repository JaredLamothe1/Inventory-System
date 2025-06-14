import React, { useState, useEffect } from 'react';
import axios from 'axios';

const UpdateProductForm = ({ productId }: { productId: number }) => {
    const [product, setProduct] = useState({
        name: '',
        unit_cost: 0,
        reorder_threshold: 0,
        storage_space: 0,
        vendor_id: 0,
        quantity_in_stock: 0
    });

    useEffect(() => {
        axios.get(`${import.meta.env.VITE_API_URL}/products/${productId}`)
            .then(response => {
                setProduct(response.data);
            })
            .catch(error => {
                console.log('Error fetching product data:', error);
            });
    }, [productId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProduct({
            ...product,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/products/${productId}`, product);
            alert('Product updated successfully!');
        } catch (error) {
            alert('Error updating product');
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="text"
                name="name"
                value={product.name}
                onChange={handleChange}
                placeholder="Product Name"
                required
            />
            <input
                type="number"
                name="unit_cost"
                value={product.unit_cost}
                onChange={handleChange}
                placeholder="Unit Cost"
                required
            />
            <input
                type="number"
                name="reorder_threshold"
                value={product.reorder_threshold}
                onChange={handleChange}
                placeholder="Reorder Threshold"
                required
            />
            <input
                type="number"
                name="storage_space"
                value={product.storage_space}
                onChange={handleChange}
                placeholder="Storage Space"
                required
            />
            <input
                type="number"
                name="vendor_id"
                value={product.vendor_id}
                onChange={handleChange}
                placeholder="Vendor ID"
                required
            />
            <input
                type="number"
                name="quantity_in_stock"
                value={product.quantity_in_stock}
                onChange={handleChange}
                placeholder="Quantity in Stock"
                required
            />
            <button type="submit">Update Product</button>
        </form>
    );
};

export default UpdateProductForm;
