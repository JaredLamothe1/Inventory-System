import React, { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "@/api";
import AddProductForm from "./AddProductForm";
import CategoryTree, { CategoryNode } from "@/components/CategoryTree";

/* ---------------- Types ---------------- */
interface Product {
  id: number;
  name: string;
  unit_cost?: number | string | null;
  sale_price?: number | string | null;
  resolved_price?: number | string | null;
  category_id: number | null;
  category_name?: string | null;
  description?: string | null;
  notes?: string | null;
  quantity_in_stock: number;
  reorder_threshold?: number;
}

interface Collection {
  id: number;
  name: string;
  product_count?: number;
}

const COLLECTIONS_URL = "/collections";

/* --------------- Component -------------- */
export default function ProductList() {
  const navigate = useNavigate();

  // Sidebar data
  const [catTree, setCatTree] = useState<CategoryNode[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);

  // Product table data
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("name-asc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0); // bump to force list refetch

  // Inline stock edit
  const [stockEditId, setStockEditId] = useState<number | null>(null);
  const [stockInput, setStockInput] = useState(0);

  // Group creation flow
  const [groupStep, setGroupStep] = useState<0 | 1>(0);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [groupMsg, setGroupMsg] = useState<string | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);

  // Add-product modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Rename / Delete
  const [editGroupId, setEditGroupId] = useState<number | null>(null);

  const [editGroupName, setEditGroupName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);
  const [deleteGroupName, setDeleteGroupName] = useState<string>("");

  // Edit products within a group
  const [editProductsGroupId, setEditProductsGroupId] = useState<number | null>(null);
  const [editProductsGroupName, setEditProductsGroupName] = useState<string>("");
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [membership, setMembership] = useState<Set<number>>(new Set());
  const [editProdSearch, setEditProdSearch] = useState("");
  const [editProductsLoading, setEditProductsLoading] = useState(false);
  const [editProductsError, setEditProductsError] = useState<string | null>(null);

  // Small “Edit” popover menu
  const [menuGroupId, setMenuGroupId] = useState<number | null>(null);

  /* ------------ initial loads ------------ */
  useEffect(() => {
    api.get("/categories/tree")
      .then(r => setCatTree(r.data))
      .catch(() => setCatTree([]));

    api.get(COLLECTIONS_URL)
      .then(r => setCollections(r.data))
      .catch(() => setCollections([]));
  }, []);

  /* -------- products list (table) -------- */
  useEffect(() => {
    const [sort_by, order] = sortOption.split("-");
    const params: any = { page: currentPage - 1, limit: 25, sort_by, order };
    if (selectedCatId != null) params.category_id = selectedCatId;
    if (selectedCollectionId != null) params.collection_id = selectedCollectionId;

    setLoading(true);
    api
      .get("/products/", { params })
      .then(r => {
        setProducts(r.data.products || []);
        setTotalPages(Math.max(r.data.total_pages || 0, 1));
        setFetchError(null);
      })
      .catch(err => {
        console.error(err);
        setProducts([]);
        setTotalPages(1);
        setFetchError("Error fetching products.");
      })
      .finally(() => setLoading(false));
  }, [currentPage, sortOption, selectedCatId, selectedCollectionId, refreshTick]);

  // Reset page on search/filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCatId, selectedCollectionId]);

  const filteredProducts = useMemo(
    () => products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [products, searchQuery]
  );

  /* ------------- stock helpers ------------ */
  const handleStockUpdate = (product: Product) => {
    api.patch(`/products/${product.id}`, { quantity_in_stock: stockInput })
      .then(r => {
        setProducts(ps => ps.map(p => (p.id === product.id ? r.data : p)));
        setStockEditId(null);
      })
      .catch(console.error);
  };

  const getStockBadge = (p: Product) => {
    const t = p.reorder_threshold ?? 0;
    const qty = p.quantity_in_stock;
    const cls =
      qty === 0 ? "bg-red-100 text-red-800"
      : qty < t ? "bg-yellow-100 text-yellow-800"
      : "bg-green-100 text-green-800";
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${cls}`}>{qty}</span>;
  };

  const getRowBg = (p: Product) => {
    const t = p.reorder_threshold ?? 0;
    if (p.quantity_in_stock < 0) return "bg-red-50";
    if (p.quantity_in_stock === 0) return "bg-red-100";
    if (p.quantity_in_stock < t) return "bg-yellow-50";
    return "";
  };

  /* ---- create new group (wizard) ---- */
  const startGroupWizard = () => {
    setGroupNameDraft("");
    setSelectedProductIds(new Set());
    setGroupMsg(null);
    setShowNameModal(true);
    setGroupStep(0);
  };
  const onNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupNameDraft.trim()) {
      setGroupMsg("Group name is required.");
      return;
    }
    setShowNameModal(false);
    setGroupStep(1);
  };
  const cancelGroupWizard = () => {
    setShowNameModal(false);
    setGroupStep(0);
    setGroupMsg(null);
    setSelectedProductIds(new Set());
  };
  const toggleSelectProduct = (id: number) => {
    setSelectedProductIds(prev => {
      const nxt = new Set(prev);
      nxt.has(id) ? nxt.delete(id) : nxt.add(id);
      return nxt;
    });
  };
  const createGroup = async () => {
    if (!groupNameDraft.trim()) return setGroupMsg("Group name is required.");
    if (selectedProductIds.size === 0) return setGroupMsg("Pick at least one product.");
    try {
      const res = await api.post(COLLECTIONS_URL + "/", {
        name: groupNameDraft.trim(),
        product_ids: Array.from(selectedProductIds),
      });
      setCollections(cs => [...cs, res.data]);
      cancelGroupWizard();
    } catch (err: any) {
      console.error(err);
      setGroupMsg(err.response?.data?.detail ?? "Failed to create group.");
    }
  };

  /* -------- rename group -------- */
  const openRenameGroup = (g: Collection) => {
    setEditGroupId(g.id);
    setEditGroupName(g.name);
    setEditError(null);
  };
  const closeRenameGroup = () => {
    setEditGroupId(null);
    setEditGroupName("");
    setEditError(null);
  };
  const submitRenameGroup = async () => {
    if (!editGroupId) return;
    if (!editGroupName.trim()) {
      setEditError("Name is required.");
      return;
    }
    try {
      const res = await api.patch(`${COLLECTIONS_URL}/${editGroupId}`, { name: editGroupName.trim() });
      setCollections(cs => cs.map(c => (c.id === editGroupId ? { ...c, name: res.data.name } : c)));
      closeRenameGroup();
    } catch (err: any) {
      console.error(err);
      setEditError(err.response?.data?.detail ?? "Failed to rename group.");
    }
  };

  /* -------- delete group -------- */
  const openDeleteGroup = (g: Collection) => {
    setDeleteGroupId(g.id);
    setDeleteGroupName(g.name);
  };
  const closeDeleteGroup = () => {
    setDeleteGroupId(null);
    setDeleteGroupName("");
  };
  const doDeleteGroup = async () => {
    if (!deleteGroupId) return;
    try {
      await api.delete(`${COLLECTIONS_URL}/${deleteGroupId}`);
      setCollections(cs => cs.filter(c => c.id !== deleteGroupId));
      if (selectedCollectionId === deleteGroupId) {
        setSelectedCollectionId(null);
      }
      closeDeleteGroup();
      setRefreshTick(t => t + 1); // refresh product list if needed
    } catch (err) {
      console.error(err);
    }
  };

  /* ---- Edit products in a group ---- */
  const openEditProducts = async (g: Collection) => {
    setEditProductsError(null);
    setEditProductsLoading(true);
    try {
      // Load current group products (expects products[] in the payload)
      const detail = await api.get(`${COLLECTIONS_URL}/${g.id}`);
      const ids = new Set<number>((detail.data?.products || []).map((p: Product) => p.id));
      setMembership(ids);
      setEditProductsGroupId(g.id);
      setEditProductsGroupName(g.name);

      // Load a big slice of catalog for selection (safe limit to avoid 422)
      const list = await api.get("/products/", {
        params: { page: 0, limit: 1000, sort_by: "name", order: "asc" },
      });
      setAllProducts(list.data.products || []);
    } catch (err: any) {
      console.error(err);
      setEditProductsError(
        err?.response?.data?.detail ||
          "Couldn't load products. Try again or narrow your catalog."
      );
      // Keep modal open so user sees the error & can retry
      setEditProductsGroupId(g.id);
      setEditProductsGroupName(g.name);
      setAllProducts([]);
    } finally {
      setEditProductsLoading(false);
      setEditProdSearch("");
    }
  };
  const closeEditProducts = () => {
    setEditProductsGroupId(null);
    setEditProductsGroupName("");
    setAllProducts([]);
    setMembership(new Set());
    setEditProdSearch("");
    setEditProductsError(null);
    setEditProductsLoading(false);
  };
  const toggleMember = (id: number) => {
    setMembership(prev => {
      const nxt = new Set(prev);
      nxt.has(id) ? nxt.delete(id) : nxt.add(id);
      return nxt;
    });
  };
  const visibleChoices = useMemo(
    () => allProducts.filter(p => p.name.toLowerCase().includes(editProdSearch.toLowerCase())),
    [allProducts, editProdSearch]
  );
  const selectAllVisible = () => {
    setMembership(prev => {
      const nxt = new Set(prev);
      visibleChoices.forEach(p => nxt.add(p.id));
      return nxt;
    });
  };
  const clearAllVisible = () => {
    setMembership(prev => {
      const nxt = new Set(prev);
      visibleChoices.forEach(p => nxt.delete(p.id));
      return nxt;
    });
  };
  const reloadAllProducts = async () => {
    setEditProductsError(null);
    setEditProductsLoading(true);
    try {
      const list = await api.get("/products/", {
        params: { page: 0, limit: 1000, sort_by: "name", order: "asc" },
      });
      setAllProducts(list.data.products || []);
    } catch (err: any) {
      console.error(err);
      setEditProductsError(err?.response?.data?.detail || "Retry failed.");
    } finally {
      setEditProductsLoading(false);
    }
  };
  const saveMembers = async () => {
    if (!editProductsGroupId) return;
    try {
      const product_ids = Array.from(membership);
      await api.patch(`${COLLECTIONS_URL}/${editProductsGroupId}`, { product_ids });
      // update count locally
      setCollections(cs =>
        cs.map(c => (c.id === editProductsGroupId ? { ...c, product_count: product_ids.length } : c))
      );
      // if viewing this group in the table, refresh
      if (selectedCollectionId === editProductsGroupId) setRefreshTick(t => t + 1);
      closeEditProducts();
    } catch (err) {
      console.error(err);
      alert("Failed to update group members.");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 p-6">
      {/* click-away overlay for small menus */}
      {menuGroupId !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuGroupId(null)} />
      )}

      {/* Sidebar */}
      <aside className="bg-white rounded-lg shadow p-4 space-y-6 relative">
        {/* Categories */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Categories</h2>
          <CategoryTree
            tree={catTree}
            selected={selectedCatId}
            onSelect={id => {
              setSelectedCatId(id);
              setSelectedCollectionId(null);
            }}
          />
        </div>

        {/* Groups */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Groups</h2>
            <button
              onClick={startGroupWizard}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> New
            </button>
          </div>

          {collections.length === 0 ? (
            <p className="text-xs text-gray-500">No groups yet.</p>
          ) : (
            <ul className="space-y-1">
              {collections.map(g => (
                <li key={g.id} className="flex items-center justify-between gap-2 relative">
                  <button
                    onClick={() => {
                      setSelectedCollectionId(g.id);
                      setSelectedCatId(null);
                    }}
                    className={`flex-1 text-left text-sm px-2 py-1 rounded ${
                      selectedCollectionId === g.id ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
                    }`}
                  >
                    {g.name}
                    {typeof g.product_count === "number" && (
                      <span className="ml-2 text-[10px] text-gray-500">({g.product_count})</span>
                    )}
                  </button>

                  <div className="flex items-center gap-1 z-20">
                    {/* EDIT menu */}
                    <div className="relative">
                      <button
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuGroupId(menuGroupId === g.id ? null : g.id);
                        }}
                        className="p-1 rounded hover:bg-gray-100"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      {menuGroupId === g.id && (
                        <div className="absolute right-0 top-7 bg-white border rounded shadow-md text-sm py-1 min-w-[160px] z-50">
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-gray-100"
                            onClick={() => {
                              setMenuGroupId(null);
                              openRenameGroup(g);
                            }}
                          >
                            Rename group
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-gray-100"
                            onClick={() => {
                              setMenuGroupId(null);
                              openEditProducts(g);
                            }}
                          >
                            Edit products
                          </button>
                        </div>
                      )}
                    </div>

                    {/* DELETE */}
                    <button
                      title="Delete group"
                      onClick={() => openDeleteGroup(g)}
                      className="p-1 rounded hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="bg-white rounded-xl shadow p-6 relative">
        {/* Group selection banner (create new) */}
        {groupStep === 1 && (
          <div className="absolute inset-x-0 top-0 bg-blue-50 border-b border-blue-200 p-3 flex items-center gap-3">
            <span className="text-sm">
              Selecting for <strong>{groupNameDraft}</strong>
            </span>
            <button onClick={createGroup} className="px-3 py-1 text-xs bg-green-600 text-white rounded">
              Create
            </button>
            <button onClick={cancelGroupWizard} className="px-3 py-1 text-xs bg-gray-300 rounded">
              Cancel
            </button>
            {groupMsg && <span className="text-xs text-red-600">{groupMsg}</span>}
          </div>
        )}

        {/* Header & controls */}
        <div className={`flex justify-between items-center mb-6 ${groupStep === 1 ? "mt-12" : ""}`}>
          <h1 className="text-3xl font-bold text-blue-700">Products</h1>
          <div className="flex items-center gap-4">
            <select
              value={sortOption}
              onChange={e => setSortOption(e.target.value)}
              className="border rounded p-2 shadow-sm text-sm"
            >
              <option value="name-asc">Name A→Z</option>
              <option value="name-desc">Name Z→A</option>
              <option value="quantity_in_stock-asc">Stock Low→High</option>
              <option value="quantity_in_stock-desc">Stock High→Low</option>
            </select>
            <button
              onClick={() => setIsModalOpen(o => !o)}
              className="px-4 py-2 bg-blue-600 text-white rounded shadow-sm text-sm"
            >
              + Add Product
            </button>
          </div>
        </div>

        {/* Fetch error */}
        {fetchError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{fetchError}</div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name…"
            className="w-full md:w-80 p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* Loading / Table */}
        {loading ? (
          <div className="text-center text-gray-700 py-12">Loading…</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center text-gray-600 py-12 space-y-4">
            <p>No products found.</p>
            <button onClick={() => setIsModalOpen(true)} className="px-6 py-2 bg-blue-600 text-white rounded shadow-sm">
              Add product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Stock</th>
                  <th className="py-2 pr-4">Sale Price</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.id} className={`${getRowBg(p)} border-b last:border-b-0`}>
                    <td className="py-2 pr-4">
                      <button className="text-blue-700 hover:underline" onClick={() => navigate(`/products/${p.id}`)}>
                        {p.name}
                      </button>
                    </td>
                    <td className="py-2 pr-4">{p.category_name ?? "—"}</td>
                    <td className="py-2 pr-4">{getStockBadge(p)}</td>
                    <td className="py-2 pr-4">
                      {p.resolved_price ?? p.sale_price ?? p.unit_cost ?? "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {stockEditId === p.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            className="w-24 border rounded p-1"
                            value={stockInput}
                            onChange={e => setStockInput(Number(e.target.value))}
                          />
                          <button className="p-1 rounded bg-green-600 text-white" onClick={() => handleStockUpdate(p)}>
                            <Check className="w-4 h-4" />
                          </button>
                          <button className="p-1 rounded bg-gray-300" onClick={() => setStockEditId(null)}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="px-2 py-1 border rounded text-xs"
                          onClick={() => {
                            setStockEditId(p.id);
                            setStockInput(p.quantity_in_stock);
                          }}
                        >
                          Edit Stock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* simple pager */}
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span className="text-xs self-center">
                Page {currentPage} / {totalPages}
              </span>
              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {isModalOpen && (
          <Modal
            title="Add Product"
            onClose={() => {
              setIsModalOpen(false);
              setRefreshTick(t => t + 1); // refresh the table when modal closes
            }}
          >
            <AddProductForm catTree={[]} />
            <div className="mt-4 text-right">
              <button
                className="px-4 py-2 border rounded text-sm"
                onClick={() => {
                  setIsModalOpen(false);
                  setRefreshTick(t => t + 1); // also refresh if user clicks Done
                }}
              >
                Done
              </button>
            </div>
          </Modal>
        )}
      </div>

      {/* Rename group modal */}
      {editGroupId !== null && (
        <Modal onClose={closeRenameGroup} title="Rename Group">
          <div className="space-y-4 text-sm">
            {editError && <div className="text-red-600 text-xs">{editError}</div>}
            <div>
              <label className="block mb-1 font-medium">New name</label>
              <input
                value={editGroupName}
                onChange={e => setEditGroupName(e.target.value)}
                className="w-full border rounded p-2"
                placeholder="Enter new group name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeRenameGroup} className="px-4 py-2 border rounded text-sm">
                Cancel
              </button>
              <button onClick={submitRenameGroup} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete group confirm */}
      {deleteGroupId !== null && (
        <Modal onClose={closeDeleteGroup} title="Delete Group">
          <div className="space-y-4 text-sm">
            <p>
              Are you sure you want to delete <strong>{deleteGroupName}</strong>? This will remove the
              group but won’t delete any products.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={closeDeleteGroup} className="px-4 py-2 border rounded text-sm">
                Cancel
              </button>
              <button onClick={doDeleteGroup} className="px-4 py-2 bg-red-600 text-white rounded text-sm">
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit products in group modal */}
      {editProductsGroupId !== null && (
        <Modal onClose={closeEditProducts} title={`Edit Products — ${editProductsGroupName}`}>
          <div className="space-y-3">
            {editProductsError && (
              <div className="p-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
                {editProductsError}
                <button
                  className="ml-2 underline"
                  onClick={reloadAllProducts}
                >
                  Retry
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                value={editProdSearch}
                onChange={e => setEditProdSearch(e.target.value)}
                placeholder="Search products…"
                className="flex-1 border rounded p-2 text-sm"
                disabled={editProductsLoading}
              />
              <button onClick={selectAllVisible} className="px-3 py-1 border rounded text-xs" disabled={editProductsLoading}>
                Select All
              </button>
              <button onClick={clearAllVisible} className="px-3 py-1 border rounded text-xs" disabled={editProductsLoading}>
                Clear
              </button>
            </div>

            <div className="max-h-80 overflow-auto border rounded">
              {editProductsLoading ? (
                <div className="p-3 text-sm text-gray-600">Loading products…</div>
              ) : visibleChoices.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">No products found.</div>
              ) : (
                <ul className="divide-y">
                  {visibleChoices.map(p => {
                    const checked = membership.has(p.id);
                    return (
                      <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(p.id)}
                        />
                        <span className="text-sm">{p.name}</span>
                        <span className="ml-auto text-[10px] text-gray-500">{p.category_name ?? "—"}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex justify-between items-center text-xs text-gray-600">
              <span>
                Selected: <strong>{membership.size}</strong>
              </span>
              <div className="flex gap-2">
                <button onClick={closeEditProducts} className="px-4 py-2 border rounded text-sm">
                  Cancel
                </button>
                <button onClick={saveMembers} className="px-4 py-2 bg-blue-600 text-white rounded text-sm" disabled={editProductsLoading}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* -------- Small helpers -------- */
const Modal = ({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/30" onClick={onClose} />
    <div className="relative bg-white rounded-lg shadow-xl w-[92vw] max-w-2xl p-4 z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
          <X className="w-5 h-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);
