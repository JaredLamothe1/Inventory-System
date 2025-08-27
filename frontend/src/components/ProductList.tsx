// src/pages/ProductList.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Check, X, Search, MoreVertical } from "lucide-react";
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

/* --------------- Utils -------------- */
const money = (n: number | string | null | undefined) => {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "—";
};

function truncate(text: string | null | undefined, n = 120): string {
  if (!text) return "—";
  const s = String(text);
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

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
  const [refreshTick, setRefreshTick] = useState(0);

  // Inline stock edit
  const [stockEditId, setStockEditId] = useState<number | null>(null);
  const [stockInput, setStockInput] = useState(0);

  // Create group flow
  const [showNameModal, setShowNameModal] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupStep, setGroupStep] = useState<0 | 1>(0); // 0 = none, 1 = picking products
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [groupMsg, setGroupMsg] = useState<string | null>(null);

  // Add-product modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Rename / Delete
  const [menuGroupId, setMenuGroupId] = useState<number | null>(null);
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

  /* ------------ initial loads ------------ */
  useEffect(() => {
    api
      .get("/categories/tree")
      .then((r) => setCatTree(r.data))
      .catch(() => setCatTree([]));

    api
      .get(COLLECTIONS_URL)
      .then((r) => setCollections(r.data))
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
      .then((r) => {
        setProducts(r.data.products || []);
        setTotalPages(Math.max(r.data.total_pages || 0, 1));
        setFetchError(null);
      })
      .catch((err) => {
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
    () =>
      products.filter((p) =>
        (p.name + " " + (p.description ?? "")).toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [products, searchQuery]
  );

  /* ------------- stock helpers ------------ */
  const handleStockUpdate = (product: Product) => {
    api
      .patch(`/products/${product.id}`, { quantity_in_stock: stockInput })
      .then((r) => {
        setProducts((ps) => ps.map((p) => (p.id === product.id ? r.data : p)));
        setStockEditId(null);
      })
      .catch(console.error);
  };

  const getStockBadge = (p: Product) => {
    const t = p.reorder_threshold ?? 0;
    const qty = p.quantity_in_stock;
    const cls =
      qty === 0
        ? "bg-red-100 text-red-800"
        : qty < t
        ? "bg-yellow-100 text-yellow-800"
        : "bg-green-100 text-green-800";
    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full tabular-nums ${cls}`}>
        {qty}
      </span>
    );
  };

  const getRowBg = (p: Product) => {
    const t = p.reorder_threshold ?? 0;
    if (p.quantity_in_stock < 0) return "bg-red-50/60";
    if (p.quantity_in_stock === 0) return "bg-red-50";
    if (p.quantity_in_stock < t) return "bg-yellow-50/60";
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
    setGroupStep(1); // show checkboxes + top banner
  };

  const cancelGroupWizard = () => {
    setShowNameModal(false);
    setGroupStep(0);
    setGroupMsg(null);
    setSelectedProductIds(new Set());
  };

  const toggleSelectProduct = (id: number) => {
    setSelectedProductIds((prev) => {
      const nxt = new Set(prev);
      nxt.has(id) ? nxt.delete(id) : nxt.add(id);
      return nxt;
    });
  };

  const selectAllVisibleForWizard = () => {
    setSelectedProductIds((prev) => {
      const nxt = new Set(prev);
      filteredProducts.forEach((p) => nxt.add(p.id));
      return nxt;
    });
  };

  const clearAllVisibleForWizard = () => {
    setSelectedProductIds((prev) => {
      const nxt = new Set(prev);
      filteredProducts.forEach((p) => nxt.delete(p.id));
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
      setCollections((cs) => [...cs, res.data]);
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
      const res = await api.patch(`${COLLECTIONS_URL}/${editGroupId}`, {
        name: editGroupName.trim(),
      });
      setCollections((cs) =>
        cs.map((c) => (c.id === editGroupId ? { ...c, name: res.data.name } : c))
      );
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
      setCollections((cs) => cs.filter((c) => c.id !== deleteGroupId));
      if (selectedCollectionId === deleteGroupId) setSelectedCollectionId(null);
      closeDeleteGroup();
      setRefreshTick((t) => t + 1);
    } catch (err) {
      console.error(err);
    }
  };

  /* ---- Edit products in a group ---- */
  const openEditProducts = async (g: Collection) => {
    setEditProductsError(null);
    setEditProductsLoading(true);
    try {
      // Load group detail to pre-check items
      const detail = await api.get(`${COLLECTIONS_URL}/${g.id}`);
      const ids = new Set<number>((detail.data?.products || []).map((p: Product) => p.id));
      setMembership(ids);
      setEditProductsGroupId(g.id);
      setEditProductsGroupName(g.name);

      // Load catalog slice
      const list = await api.get("/products/", {
        params: { page: 0, limit: 1000, sort_by: "name", order: "asc" },
      });
      setAllProducts(list.data.products || []);
    } catch (err: any) {
      console.error(err);
      setEditProductsError(
        err?.response?.data?.detail || "Couldn't load products. Try again or narrow your catalog."
      );
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
    setMembership((prev) => {
      const nxt = new Set(prev);
      nxt.has(id) ? nxt.delete(id) : nxt.add(id);
      return nxt;
    });
  };
  const visibleChoices = useMemo(
    () =>
      allProducts.filter((p) =>
        (p.name + " " + (p.description ?? "")).toLowerCase().includes(editProdSearch.toLowerCase())
      ),
    [allProducts, editProdSearch]
  );
  const selectAllVisible = () => {
    setMembership((prev) => {
      const nxt = new Set(prev);
      visibleChoices.forEach((p) => nxt.add(p.id));
      return nxt;
    });
  };
  const clearAllVisible = () => {
    setMembership((prev) => {
      const nxt = new Set(prev);
      visibleChoices.forEach((p) => nxt.delete(p.id));
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
      setCollections((cs) =>
        cs.map((c) =>
          c.id === editProductsGroupId ? { ...c, product_count: product_ids.length } : c
        )
      );
      // refresh table if viewing this group
      if (selectedCollectionId === editProductsGroupId) setRefreshTick((t) => t + 1);
      closeEditProducts();
    } catch (err) {
      console.error(err);
      alert("Failed to update group members.");
    }
  };

  // Prevent row navigation when clicking interactive controls
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      {/* click-away overlay for small menus */}
      {menuGroupId !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuGroupId(null)} />
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {/* Categories */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-gradient-to-br from-blue-600 to-indigo-600" />
              <h2 className="text-sm font-semibold tracking-wide text-slate-700">Categories</h2>
            </div>
            <CategoryTree
              tree={catTree}
              selected={selectedCatId}
              onSelect={(id) => {
                setSelectedCatId(id);
                setSelectedCollectionId(null);
              }}
            />
          </div>

          {/* Groups */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-slate-700">Groups</h2>
              <button
                onClick={startGroupWizard}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            </div>

            {collections.length === 0 ? (
              <p className="text-xs text-slate-500">No groups yet.</p>
            ) : (
              <ul className="space-y-1">
                {collections.map((g) => (
                  <li key={g.id} className="relative flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedCollectionId(g.id);
                        setSelectedCatId(null);
                      }}
                      className={`flex-1 truncate rounded-lg px-2 py-1 text-left text-sm ${
                        selectedCollectionId === g.id
                          ? "bg-blue-600/10 text-blue-700"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {g.name}
                      {typeof g.product_count === "number" && (
                        <span className="ml-2 text-[10px] text-slate-500">
                          ({g.product_count})
                        </span>
                      )}
                    </button>

                    <div className="z-20">
                      <button
                        title="More"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuGroupId(menuGroupId === g.id ? null : g.id);
                        }}
                        className="rounded-md p-1 hover:bg-slate-100"
                      >
                        <MoreVertical className="h-4 w-4 text-slate-600" />
                      </button>

                      {menuGroupId === g.id && (
                        <div className="absolute right-0 top-7 z-50 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-md">
                          <button
                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => {
                              setMenuGroupId(null);
                              openRenameGroup(g);
                            }}
                          >
                            Rename group
                          </button>
                          <button
                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => {
                              setMenuGroupId(null);
                              openEditProducts(g);
                            }}
                          >
                            Edit products
                          </button>
                          <button
                            className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setMenuGroupId(null);
                              openDeleteGroup(g);
                            }}
                          >
                            Delete group
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Main content */}
        <section className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          {/* Group selection banner (create new) */}
          {groupStep === 1 && (
            <div className="absolute inset-x-0 top-0 z-10 border-b border-blue-200 bg-blue-50/80 px-3 py-2 backdrop-blur">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-slate-800">
                  Picking products for <strong>{groupNameDraft}</strong>
                </span>
                <button
                  onClick={createGroup}
                  className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                >
                  Create group
                </button>
                <button
                  onClick={cancelGroupWizard}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <span className="text-xs text-slate-700">
                  Selected: <strong>{selectedProductIds.size}</strong>
                </span>
                <button
                  onClick={selectAllVisibleForWizard}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                >
                  Select All (visible)
                </button>
                <button
                  onClick={clearAllVisibleForWizard}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                >
                  Clear (visible)
                </button>
                {groupMsg && <span className="text-xs text-red-600">{groupMsg}</span>}
              </div>
            </div>
          )}

          {/* Header & controls */}
          <div className={`sticky top-0 z-0 -mx-4 -mt-4 border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur md:-mx-6 md:px-6 ${groupStep === 1 ? "pt-10 md:pt-12" : ""}`}>
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Products</h1>
              <div className="flex w-full flex-col-reverse items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name or description…"
                    className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-80"
                  />
                </div>

                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="name-asc">Name A→Z</option>
                  <option value="name-desc">Name Z→A</option>
                  <option value="quantity_in_stock-asc">Stock Low→High</option>
                  <option value="quantity_in_stock-desc">Stock High→Low</option>
                </select>

                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Product
                </button>
              </div>
            </div>

            {fetchError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {fetchError}
              </div>
            )}
          </div>

          {/* Loading / Table */}
          {loading ? (
            <div className="py-16 text-center text-slate-600">Loading…</div>
          ) : filteredProducts.length === 0 ? (
            <div className="space-y-4 py-16 text-center text-slate-600">
              <p>No products found.</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Add product
              </button>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    {groupStep === 1 && <th className="w-12 py-2 pr-4">Pick</th>}
                    <th className="py-2 pr-4">Name</th>
                    <th className="w-[34rem] py-2 pr-4">Description</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Stock</th>
                    <th className="py-2 pr-4">Sale Price</th>
                    <th className="py-2 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => {
                    const checked = selectedProductIds.has(p.id);
                    const canNavigate = groupStep !== 1;

                    const onRowClick = () => {
                      if (canNavigate) navigate(`/products/${p.id}`);
                    };
                    const onRowKey = (e: React.KeyboardEvent) => {
                      if (!canNavigate) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/products/${p.id}`);
                      }
                    };

                    return (
                      <tr
                        key={p.id}
                        onClick={onRowClick}
                        onKeyDown={onRowKey}
                        tabIndex={canNavigate ? 0 : -1}
                        role={canNavigate ? "button" : undefined}
                        className={`${getRowBg(p)} ${
                          canNavigate ? "cursor-pointer hover:bg-slate-50/80 focus:bg-blue-50" : ""
                        } outline-none`}
                      >
                        {groupStep === 1 && (
                          <td className="py-2 pr-4">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelectProduct(p.id)}
                              onClick={stop}
                              aria-label={`Pick ${p.name}`}
                            />
                          </td>
                        )}

                        {/* Name (no link; row is clickable) */}
                        <td className="py-2 pr-4">
                          <div className="font-medium text-slate-800">{p.name}</div>
                        </td>

                        <td className="py-2 pr-4 text-slate-700" title={p.description ?? ""}>
                          {truncate(p.description, 120)}
                        </td>
                        <td className="py-2 pr-4 text-slate-700">{p.category_name ?? "—"}</td>
                        <td className="py-2 pr-4">{getStockBadge(p)}</td>
                        <td className="py-2 pr-4 tabular-nums">
                          {money(p.resolved_price ?? p.sale_price ?? p.unit_cost)}
                        </td>

                        {/* Actions (stop propagation so row doesn't navigate) */}
                        <td className="py-2 pr-2" onClick={stop}>
                          {stockEditId === p.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="number"
                                value={stockInput}
                                onChange={(e) => setStockInput(Number(e.target.value))}
                                className="h-9 w-24 rounded-md border border-slate-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onClick={stop}
                              />
                              <button
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-green-600 text-white hover:bg-green-700"
                                onClick={() => handleStockUpdate(p)}
                                title="Save"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50"
                                onClick={() => setStockEditId(null)}
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <button
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs hover:bg-slate-50"
                                onClick={() => {
                                  setStockEditId(p.id);
                                  setStockInput(p.quantity_in_stock);
                                }}
                              >
                                Edit Stock
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pager */}
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm disabled:opacity-50 hover:bg-slate-50"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span className="text-xs text-slate-600">
                  Page <strong>{currentPage}</strong> / {totalPages}
                </span>
                <button
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm disabled:opacity-50 hover:bg-slate-50"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Add Product */}
         {isModalOpen && (
  <Modal
    title="Add Product"
    onClose={() => {
      setIsModalOpen(false);
      setRefreshTick((t) => t + 1);
    }}
  >
    <AddProductForm
      catTree={catTree}                 // ← use the actual categories
      initialCategoryId={selectedCatId} // ← preselect current filter (optional)
      closeForm={() => {
        setIsModalOpen(false);
        setRefreshTick((t) => t + 1);
      }}
    />
    {/* Remove the separate "Done" button; the form closes itself on success */}
  </Modal>
)}


        </section>
      </div>

      {/* Name group modal (Step 0) */}
      {showNameModal && (
        <Modal onClose={cancelGroupWizard} title="Name your group">
          <form onSubmit={onNameSubmit} className="space-y-4 text-sm">
            {groupMsg && <div className="text-xs text-red-600">{groupMsg}</div>}
            <div>
              <label className="mb-1 block font-medium">Group name</label>
              <input
                autoFocus
                value={groupNameDraft}
                onChange={(e) => setGroupNameDraft(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Starter Bundle"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelGroupWizard}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Next: pick products
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Rename group modal */}
      {editGroupId !== null && (
        <Modal onClose={closeRenameGroup} title="Rename Group">
          <div className="space-y-4 text-sm">
            {editError && <div className="text-xs text-red-600">{editError}</div>}
            <div>
              <label className="mb-1 block font-medium">New name</label>
              <input
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new group name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={closeRenameGroup}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitRenameGroup}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
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
              Are you sure you want to delete <strong>{deleteGroupName}</strong>? This removes the
              group but won’t delete any products.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={closeDeleteGroup}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={doDeleteGroup}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
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
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {editProductsError}
                <button className="ml-2 underline" onClick={reloadAllProducts}>
                  Retry
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                value={editProdSearch}
                onChange={(e) => setEditProdSearch(e.target.value)}
                placeholder="Search products…"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={editProductsLoading}
              />
              <button
                onClick={selectAllVisible}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                disabled={editProductsLoading}
              >
                Select All
              </button>
              <button
                onClick={clearAllVisible}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                disabled={editProductsLoading}
              >
                Clear
              </button>
            </div>

            <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
              {editProductsLoading ? (
                <div className="p-3 text-sm text-slate-600">Loading products…</div>
              ) : visibleChoices.length === 0 ? (
                <div className="p-3 text-sm text-slate-500">No products found.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {visibleChoices.map((p) => {
                    const checked = membership.has(p.id);
                    return (
                      <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(p.id)}
                        />
                        <span className="text-sm">{p.name}</span>
                        <span
                          className="ml-2 truncate text-[11px] text-slate-500"
                          title={p.description ?? ""}
                        >
                          {truncate(p.description, 80)}
                        </span>
                        <span className="ml-auto text-[10px] text-slate-500">
                          {p.category_name ?? "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Selected: <strong>{membership.size}</strong>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={closeEditProducts}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveMembers}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  disabled={editProductsLoading}
                >
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
  <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative z-50 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);
