import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AddProductForm from './AddProductForm';
import { Pencil, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Product {
  id: number;
  name: string;
  unit_cost: number;
  reorder_threshold: number;
  storage_space: number | null;
  vendor_id: number | null;
  category_id: number;
  quantity_in_stock: number;
}

interface Category {
  id: number | 'all';
  name: string;
}

const ProductList = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [stockEditId, setStockEditId] = useState<number | null>(null);
  const [stockInput, setStockInput] = useState<number>(0);
  const [sortOption, setSortOption] = useState<string>('name-asc');

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/categories')
      .then(res => {
        const withAll = [{ id: 'all', name: 'All' }, ...res.data];
        setCategories(withAll);
        setSelectedCategory('all');
        setLoading(false);
      })
      .catch(() => {
        setError("Error fetching categories");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const [sort_by, order] = sortOption.split('-');
    const params: any = {
      page: currentPage - 1,
      limit: 25,
      sort_by,
      order,
    };
    if (selectedCategory !== 'all') {
      params.category_id = selectedCategory;
    }
    axios.get('http://127.0.0.1:8000/products/', { params })
      .then((res) => {
        setProducts(res.data.products);
        setTotalPages(res.data.total_pages);
      })
      .catch(() => {
        setError('Error fetching products');
      });
  }, [currentPage, sortOption, selectedCategory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortOption(e.target.value);
  };

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleStockUpdate = (product: Product) => {
    axios.put(`http://127.0.0.1:8000/products/${product.id}`, {
      ...product,
      quantity_in_stock: stockInput,
    }).then(res => {
      setProducts(products.map(p => p.id === product.id ? res.data : p));
      setStockEditId(null);
    });
  };

  const getStockLabel = (product: Product) => {
  if (product.quantity_in_stock < 0) {
    return (
      <span className="ml-4 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-200 text-red-800">
        Error
      </span>
    );
  } else if (product.quantity_in_stock === 0) {
    return (
      <span className="ml-4 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
        Out
      </span>
    );
  } else if (product.quantity_in_stock < product.reorder_threshold) {
    return (
      <span className="ml-4 px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
        Low
      </span>
    );
  } else {
    return (
      <span className="ml-4 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">
        Good
      </span>
    );
  }
};


  const getRowBg = (product: Product) => {
  if (product.quantity_in_stock < 0) return 'bg-red-200';
  if (product.quantity_in_stock === 0) return 'bg-red-50';
  if (product.quantity_in_stock < product.reorder_threshold) return 'bg-yellow-50';
  return '';
};


  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="text-center text-xl text-gray-700">Loading products...</div>;
  if (error) return <div className="text-center text-red-600">{error}</div>;

  return (
    <div className="container mx-auto p-6 bg-gradient-to-br from-blue-50 to-gray-100 rounded-xl shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-extrabold text-blue-700">Product Inventory</h1>
        <div className="flex items-center gap-4">
          <select
            value={sortOption}
            onChange={handleSortChange}
            className="border border-gray-300 rounded p-2 shadow-sm"
          >
            <option value="name-asc">Name (A → Z)</option>
            <option value="name-desc">Name (Z → A)</option>
            <option value="quantity_in_stock-asc">Stock (Low → High)</option>
            <option value="quantity_in_stock-desc">Stock (High → Low)</option>
          </select>
          <button
            onClick={toggleModal}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-semibold rounded-full shadow-lg hover:scale-105 transition-transform"
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCategory(cat.id);
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-full text-sm font-semibold border ${
              selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Search by product name..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full mt-4 table-auto border-collapse bg-white rounded-lg shadow-md">
          <thead className="bg-white text-blue-800 border-b">
            <tr>
              <th className="px-6 py-4 text-left">Name</th>
              <th className="px-6 py-4 text-left">In Stock</th>
            </tr>
          </thead>
          <tbody className="text-gray-800">
            {filteredProducts.map((product) => (
              <tr
                key={product.id}
                className={`border-b hover:bg-gray-100 cursor-pointer ${getRowBg(product)}`}
              >
                <td
                  className="px-6 py-4 font-medium"
                  onClick={() => navigate(`/products/${product.id}`)}
                >
                  {product.name}
                </td>
                <td className="px-6 py-4">
                  <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {stockEditId === product.id ? (
                      <>
                        <input
                          type="number"
                          value={stockInput}
                          onChange={(e) => setStockInput(Number(e.target.value))}
                          onKeyDown={(e) => e.key === 'Enter' && handleStockUpdate(product)}
                          className="border p-1 rounded w-20"
                        />
                        <button onClick={() => handleStockUpdate(product)}><Check className="w-4 h-4 text-green-600" /></button>
                        <button onClick={() => setStockEditId(null)}><X className="w-4 h-4 text-gray-500" /></button>
                      </>
                    ) : (
                      <>
                        {product.quantity_in_stock}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setStockEditId(product.id);
                            setStockInput(product.quantity_in_stock);
                          }}
                        >
                          <Pencil className="w-4 h-4 text-blue-600" />
                        </button>
                        {getStockLabel(product)}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 flex justify-center space-x-4">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300 hover:bg-blue-700"
        >
          Prev
        </button>
        <span className="self-center font-medium text-gray-700">{`Page ${currentPage} of ${totalPages}`}</span>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300 hover:bg-blue-700"
        >
          Next
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 flex justify-center items-center z-50 bg-black bg-opacity-40">
          <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-md relative">
            <button
              onClick={toggleModal}
              className="absolute top-2 right-2 text-xl text-gray-500 hover:text-gray-700"
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold mb-4 text-blue-700">Add New Product</h2>
            <AddProductForm closeForm={toggleModal} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;
