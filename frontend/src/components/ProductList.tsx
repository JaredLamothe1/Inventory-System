import React, { useEffect, useState, useMemo } from "react";
import { Pencil, Check, X, Plus, Trash2 } from "lucide-react";
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

  // Inline stock edit
  const [stockEditId, setStockEditId] = useState<number | null>(null);
  const [stockInput, setStockInput] = useState(0);

  // Grouping flow (unchanged for creating new group)
  const [groupStep, setGroupStep] = useState<0 | 1>(0);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [groupMsg, setGroupMsg] = useState<string | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);

  // Add-product modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // NEW: edit/delete group modals
  const [editGroupId, setEditGroupId] = useState<number | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);
  const [deleteGroupName, setDeleteGroupName] = useState<string>("");

  // Fetch categories & collections once
  useEffect(() => {
    api.get("/categories/tree").then(r => setCatTree(r.data)).catch(() => setCatTree([]));
    api.get(COLLECTIONS_URL).then(r => setCollections(r.data)).catch(() => setCollections([]));
  }, []);

  // Fetch products whenever filters change
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
  }, [currentPage, sortOption, selectedCatId, selectedCollectionId]);

  // Reset page on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCatId, selectedCollectionId]);

  const filteredProducts = useMemo(
    () => products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [products, searchQuery]
  );

  // Inline stock update
  const handleStockUpdate = (product: Product) => {
    api
      .patch(`/products/${product.id}`, { quantity_in_stock: stockInput })
      .then(r => {
        setProducts(ps => ps.map(p => (p.id === product.id ? r.data : p)));
        setStockEditId(null);
      })
      .catch(console.error);
  };

  // Row background based on stock
  const getRowBg = (p: Product) => {
    const t = p.reorder_threshold ?? 0;
    if (p.quantity_in_stock < 0) return "bg-red-50";
    if (p.quantity_in_stock === 0) return "bg-red-100";
    if (p.quantity_in_stock < t) return "bg-yellow-50";
    return "";
  };

  // Group wizard handlers (create new)
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

  /* ---------- NEW: rename group ---------- */
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

  /* ---------- NEW: delete group ---------- */
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
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 p-6">
      {/* Sidebar */}
      <aside className="bg-white rounded-lg shadow p-4 space-y-6">
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
              {collections.map(g => {
                const isSelected = selectedCollectionId === g.id;
                return (
                  <li key={g.id}>
                    <div className={`flex items-center justify-between rounded ${isSelected ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"}`}>
                      <button
                        onClick={() => {
                          setSelectedCollectionId(g.id);
                          setSelectedCatId(null);
                        }}
                        className="flex-1 text-left text-sm px-2 py-1 truncate"
                        title={g.name}
                      >
                        {g.name}
                        {typeof g.product_count === "number" && (
                          <span className="ml-2 text-[10px] text-gray-500">
                            ({g.product_count})
                          </span>
                        )}
                      </button>

                      {/* NEW: quick actions */}
                      <div className="flex items-center gap-1 pr-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openRenameGroup(g);
                          }}
                          className="p-1 rounded hover:bg-gray-200"
                          title="Rename"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteGroup(g);
                          }}
                          className="p-1 rounded hover:bg-gray-200"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="bg-white rounded-xl shadow p-6 relative">
        {/* Group selection banner */}
        {groupStep === 1 && (
          <div className="absolute inset-x-0 top-0 bg-blue-50 border-b border-blue-200 p-3 flex items-center gap-3">
            <span className="text-sm">
              Selecting for <strong>{groupNameDraft}</strong>
            </span>
            <button
              onClick={createGroup}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded"
            >
              Create
            </button>
            <button
              onClick={cancelGroupWizard}
              className="px-3 py-1 text-xs bg-gray-300 rounded"
            >
              Cancel
            </button>
            {groupMsg && <span className="text-xs text-red-600">{groupMsg}</span>}
          </div>
        )}

        {/* Header & controls */}
        <div
          className={`flex justify-between items-center mb-6 ${
            groupStep === 1 ? "mt-12" : ""
          }`}
        >
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
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">
            {fetchError}
          </div>
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

        {/* Loading / Empty */}
        {loading ? (
          <div className="text-center text-gray-700 py-12">Loading…</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center text-gray-600 py-12 space-y-4">
            <p>No products found.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded shadow-sm"
            >
              Add product
            </button>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  {groupStep === 1 && <col style={{ width: "50px" }} />}
                  <col style={{ width: "260px" }} /> {/* Name */}
                  <col style={{ width: "160px" }} /> {/* Category */}
                  <col style={{ width: "320px" }} /> {/* Description */}
                  <col style={{ width: "220px" }} /> {/* Notes */}
                  <col style={{ width: "120px" }} /> {/* Stock */}
                  <col /> {/* Edit */}
                </colgroup>
                <thead className="bg-gray-100">
                  <tr>
                    {groupStep === 1 && <th className="py-4 px-6"></th>}
                    <th className="py-4 px-6 text-left text-sm">Name</th>
                    <th className="py-4 px-6 text-left text-sm">Category</th>
                    <th className="py-4 px-6 text-left text-sm">Description</th>
                    <th className="py-4 px-6 text-left text-sm">Notes</th>
                    <th className="py-4 px-6 text-right text-sm">Stock</th>
                    <th className="py-4 px-6 text-right text-sm">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => {
                    const checked = selectedProductIds.has(p.id);
                    return (
                      <tr
                        key={p.id}
                        className={`border-b hover:bg-gray-50 ${
                          groupStep === 1 ? "cursor-pointer" : ""
                        } ${getRowBg(p)}`}
                      >
                        {/* Group checkbox */}
                        {groupStep === 1 && (
                          <td className="py-4 px-6 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelectProduct(p.id)}
                            />
                          </td>
                        )}

                        {/* Name */}
                        <td
                          className="py-4 px-6 truncate whitespace-nowrap text-sm font-medium"
                          title={p.name}
                        >
                          {p.name}
                        </td>

                        {/* Category */}
                        <td
                          className="py-4 px-6 truncate whitespace-nowrap text-sm text-gray-700"
                          title={p.category_name || ""}
                        >
                          {p.category_name || "—"}
                        </td>

                        {/* Description */}
                        <td
                          className="py-4 px-6 truncate whitespace-nowrap text-sm text-gray-600"
                          title={p.description || ""}
                        >
                          {p.description || "—"}
                        </td>

                        {/* Notes */}
                        <td
                          className="py-4 px-6 truncate whitespace-nowrap text-sm text-gray-600"
                          title={p.notes || ""}
                        >
                          {p.notes || "—"}
                        </td>

                        {/* Stock with inline edit */}
                        <td className="py-4 px-6 text-right text-sm">
                          {stockEditId === p.id ? (
                            <div className="inline-flex items-center gap-2">
                              <input
                                type="number"
                                value={stockInput}
                                onChange={e => setStockInput(Number(e.target.value))}
                                onKeyDown={e => e.key === "Enter" && handleStockUpdate(p)}
                                className="w-16 border p-1 rounded text-sm"
                              />
                              <button onClick={() => handleStockUpdate(p)}>
                                <Check className="w-4 h-4 text-green-600" />
                              </button>
                              <button onClick={() => setStockEditId(null)}>
                                <X className="w-4 h-4 text-gray-500" />
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              <span>{p.quantity_in_stock}</span>
                              <button
                                onClick={() => {
                                  setStockEditId(p.id);
                                  setStockInput(p.quantity_in_stock);
                                }}
                                className="text-gray-500"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Edit button */}
                        <td className="py-4 px-6 text-right text-sm">
                          <button
                            onClick={() => navigate(`/products/${p.id}`)}
                            className="text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex justify-center items-center gap-4">
              <button
                onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:bg-gray-300"
              >
                Prev
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:bg-gray-300"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {isModalOpen && (
        <Modal onClose={() => setIsModalOpen(false)} title="Add Product">
          <AddProductForm closeForm={() => setIsModalOpen(false)} catTree={catTree} />
        </Modal>
      )}

      {showNameModal && (
        <Modal onClose={cancelGroupWizard} title="New Group">
          <form onSubmit={onNameSubmit} className="space-y-4 text-sm">
            {groupMsg && <p className="text-red-600 text-xs">{groupMsg}</p>}
            <div>
              <label className="block mb-1 font-medium">Group name</label>
              <input
                value={groupNameDraft}
                onChange={e => setGroupNameDraft(e.target.value)}
                className="w-full border rounded p-2"
                placeholder="e.g. Top sellers"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelGroupWizard}
                className="px-4 py-2 border rounded text-sm"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
                Next
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* NEW: Rename group modal */}
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

      {/* NEW: Delete group confirm */}
      {deleteGroupId !== null && (
        <Modal onClose={closeDeleteGroup} title="Delete Group">
          <div className="space-y-4 text-sm">
            <p>
              Are you sure you want to delete <strong>{deleteGroupName}</strong>?
              This will remove the group but won’t delete any products.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={closeDeleteGroup} className="px-4 py-2 border rounded text-sm">
                Cancel
              </button>
              <button
                onClick={doDeleteGroup}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm"
              >
                Delete
              </button>
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
  <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/40 p-4">
    <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-md relative">
      <button onClick={onClose} className="absolute top-2 right-2 text-xl text-gray-500 hover:text-gray-700">
        &times;
      </button>
      <h2 className="text-2xl font-bold mb-4 text-blue-700">{title}</h2>
      {children}
    </div>
  </div>
);
