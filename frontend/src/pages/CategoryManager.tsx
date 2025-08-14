import { useEffect, useState } from "react";
import api from "@/api";
import { Plus, Pencil, Trash2 } from "lucide-react";

/* -------- Types -------- */
type Msg = { text: string; isError: boolean } | null;

type PurchaseTier = {
  id?: number;
  threshold: number;
  price: number;
};

type CategoryOut = {
  id: number;
  name: string;
  description?: string | null;
  default_sale_price?: number | null;
  base_purchase_price?: number | null;
  purchase_tiers: PurchaseTier[];
};

/* -------- Component -------- */
export default function CategoryManager() {
  const [categories, setCategories] = useState<CategoryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<Msg>(null);

  // Modal & form
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [formName, setFormName] = useState("");
  const [formSalePrice, setFormSalePrice] = useState<string>("");
  const [formBasePurchasePrice, setFormBasePurchasePrice] = useState<string>("");
  const [formPurchaseTiers, setFormPurchaseTiers] = useState<PurchaseTier[]>([]);

  const [origSale, setOrigSale] = useState<number | null>(null);
  const [origPurchase, setOrigPurchase] = useState<number | null>(null);

  // Tier editing
  const [editingTierIdx, setEditingTierIdx] = useState<number | null>(null);
  const [draftTier, setDraftTier] = useState<PurchaseTier | null>(null);

  // Cascade confirm
  const [showCascadeConfirm, setShowCascadeConfirm] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  function fetchCategories() {
    setLoading(true);
    api
      .get<CategoryOut[]>("/categories/")
      .then((res) => setCategories(res.data))
      .catch(() => setMsg({ text: "Failed to load categories.", isError: true }))
      .finally(() => setLoading(false));
  }

  function resetForm() {
    setFormName("");
    setFormSalePrice("");
    setFormBasePurchasePrice("");
    setFormPurchaseTiers([]);
    setOrigSale(null);
    setOrigPurchase(null);
    setEditingTierIdx(null);
    setDraftTier(null);
    setMsg(null);
  }

  function openCreate() {
    setEditId(null);
    resetForm();
    setShowModal(true);
  }

  async function openEdit(id: number) {
    setEditId(id);
    resetForm();
    setShowModal(true);
    setModalLoading(true);
    try {
      const { data: c } = await api.get<CategoryOut>(`/categories/${id}`);
      setFormName(c.name);
      setFormSalePrice(c.default_sale_price != null ? String(c.default_sale_price) : "");
      setFormBasePurchasePrice(c.base_purchase_price != null ? String(c.base_purchase_price) : "");
      setFormPurchaseTiers([...c.purchase_tiers].sort((a, b) => a.threshold - b.threshold));
      setOrigSale(c.default_sale_price ?? null);
      setOrigPurchase(c.base_purchase_price ?? null);
    } catch (err: any) {
      setMsg({ text: err.response?.data?.detail || "Failed to load category.", isError: true });
      setShowModal(false);
    } finally {
      setModalLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this category?")) return;
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
    } catch (err: any) {
      setMsg({ text: err.response?.data?.detail || "Delete failed.", isError: true });
    }
  }

  async function submitToServer(payload: any) {
    try {
      if (editId == null) {
        await api.post("/categories/", payload);
      } else {
        await api.patch(`/categories/${editId}`, payload);
      }
      setShowModal(false);
      setShowCascadeConfirm(false);
      fetchCategories();
      setMsg({ text: "Saved!", isError: false });
    } catch (err: any) {
      setMsg({ text: err.response?.data?.detail || "Save failed.", isError: true });
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingTierIdx !== null) {
      setMsg({ text: "Finish editing the tier first.", isError: true });
      return;
    }

    const basePayload = {
      name: formName.trim(),
      default_sale_price: formSalePrice === "" ? null : Number(formSalePrice),
      base_purchase_price: formBasePurchasePrice === "" ? null : Number(formBasePurchasePrice),
      purchase_tiers: formPurchaseTiers.map((t) => ({
        id: t.id,
        threshold: t.threshold,
        price: t.price,
      })),
      propagate_prices: false,
      propagate_sale_price: false,
      propagate_purchase_cost: false,
    };

    if (editId != null) {
      const saleChanged = (basePayload.default_sale_price ?? null) !== (origSale ?? null);
      const purchaseChanged = (basePayload.base_purchase_price ?? null) !== (origPurchase ?? null);
      if (saleChanged || purchaseChanged) {
        setPendingPayload(basePayload);
        setShowCascadeConfirm(true);
        return;
      }
    }

    submitToServer(basePayload);
  }

  /* ---- Tier helpers ---- */
  function startAddTier() {
    setEditingTierIdx(-1);
    setDraftTier({ threshold: 1, price: 0 });
  }
  function startEditTier(idx: number) {
    setEditingTierIdx(idx);
    setDraftTier({ ...formPurchaseTiers[idx] });
  }
  function cancelTierEdit() {
    setEditingTierIdx(null);
    setDraftTier(null);
  }
  function saveTier() {
    if (!draftTier) return;
    const { threshold, price } = draftTier;
    if (threshold < 1 || price < 0) {
      setMsg({ text: "Invalid tier values.", isError: true });
      return;
    }
    const next = [...formPurchaseTiers];
    if (editingTierIdx === -1) next.push({ threshold, price });
    else if (editingTierIdx !== null) next[editingTierIdx] = { threshold, price };
    next.sort((a, b) => a.threshold - b.threshold);
    setFormPurchaseTiers(next);
    cancelTierEdit();
  }
  function removeTier(idx: number) {
    if (!confirm("Remove this tier?")) return;
    const next = [...formPurchaseTiers];
    next.splice(idx, 1);
    setFormPurchaseTiers(next);
    if (editingTierIdx === idx) cancelTierEdit();
  }

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" /> New Category
        </button>
      </div>

      {/* Message */}
      {msg && (
        <p className={msg.isError ? "text-red-600 mb-4" : "text-green-600 mb-4"}>
          {msg.text}
        </p>
      )}

{/* List with product counts */}
{loading ? (
  <p>Loading…</p>
) : categories.length === 0 ? (
  <p>No categories yet.</p>
) : (
  <div className="border rounded overflow-hidden">
    {/* Header row */}
    <div className="bg-gray-100 p-3 grid grid-cols-[200px_150px_auto] items-center gap-4">
      <div className="font-semibold">Category</div>
      <div className="font-semibold text-xs"># Products</div>
      <div className="font-semibold text-xs text-right">Actions</div>
    </div>

    {/* Data rows */}
    {categories.map((c) => (
      <div
        key={c.id}
        className="p-3 grid grid-cols-[200px_150px_auto] items-center gap-4 hover:bg-gray-50"
      >
        {/* Name */}
        <div className="truncate" title={c.name}>
          {c.name}
        </div>

        {/* Product count */}
        <div className="text-xs">
          {typeof (c as any).product_count === "number"
            ? (c as any).product_count
            : "—"}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end text-gray-500">
          <button onClick={() => openEdit(c.id)}>
            <Pencil />
          </button>
          <button onClick={() => handleDelete(c.id)}>
            <Trash2 />
          </button>
        </div>
      </div>
    ))}
  </div>
)}





      {/* Create/Edit Modal */}
      {showModal && (
        <Modal title={editId ? "Edit Category" : "New Category"} onClose={() => setShowModal(false)}>
          {modalLoading ? (
            <p>Loading…</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block mb-1 font-medium">Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full border rounded p-2"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1">Default Sale Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formSalePrice}
                    onChange={(e) => setFormSalePrice(e.target.value)}
                    className="w-full border rounded p-2"
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Default Purchase Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formBasePurchasePrice}
                    onChange={(e) => setFormBasePurchasePrice(e.target.value)}
                    className="w-full border rounded p-2"
                    placeholder="optional"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm">Purchase Tiers</span>
                  <button
                    type="button"
                    onClick={startAddTier}
                    disabled={editingTierIdx !== null}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:bg-gray-400"
                  >
                    + Add
                  </button>
                </div>
                {formPurchaseTiers.map((t, i) => (
                  <TierRow
                    key={i}
                    tier={t}
                    editing={editingTierIdx === i}
                    disabled={editingTierIdx != null && editingTierIdx !== i}
                    onEdit={() => startEditTier(i)}
                    onDelete={() => removeTier(i)}
                    onChangeDraft={(d) => setDraftTier(d)}
                    onSave={saveTier}
                    onCancel={cancelTierEdit}
                  />
                ))}
                {editingTierIdx === -1 && draftTier && (
                  <TierRow
                    tier={draftTier}
                    editing
                    adding
                    onChangeDraft={(d) => setDraftTier(d)}
                    onSave={saveTier}
                    onCancel={cancelTierEdit}
                  />
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
                  Save
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Cascade Confirmation Modal */}
      {showCascadeConfirm && (
        <Modal title="Apply new prices to products?" onClose={() => setShowCascadeConfirm(false)}>
          <p className="text-sm mb-4">
            You changed this category’s default sale and/or purchase prices. How should existing products be updated?
          </p>
          <div className="flex justify-end gap-2">
            <button
              className="px-4 py-2 border rounded text-sm"
              onClick={() => submitToServer(pendingPayload)}
            >
              No cascade
            </button>
            <button
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded text-sm"
              onClick={() =>
                submitToServer({
                  ...pendingPayload,
                  propagate_sale_price: true,
                  propagate_purchase_cost: true,
                })
              }
            >
              Update non‑overridden only
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
              onClick={() =>
                submitToServer({ ...pendingPayload, propagate_prices: true })
              }
            >
              Override all products
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* -------- Subcomponents -------- */
type ModalProps = { title: string; children: React.ReactNode; onClose: () => void };
const Modal = ({ title, children, onClose }: ModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
        ×
      </button>
      {children}
    </div>
  </div>
);

function TierRow({
  tier,
  editing,
  disabled,
  adding = false,
  onEdit,
  onDelete,
  onChangeDraft,
  onSave,
  onCancel,
}: {
  tier: PurchaseTier;
  editing: boolean;
  disabled?: boolean;
  adding?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onChangeDraft?: (t: PurchaseTier) => void;
  onSave?: () => void;
  onCancel?: () => void;
}) {
  if (editing) {
    return (
      <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center bg-gray-50 p-2 rounded">
        <input
          type="number"
          min={1}
          value={tier.threshold}
          onChange={(e) => onChangeDraft?.({ ...tier, threshold: Number(e.target.value) })}
          className="border rounded p-1 text-sm"
        />
        <input
          type="number"
          min={0}
          step="0.01"
          value={tier.price}
          onChange={(e) => onChangeDraft?.({ ...tier, price: Number(e.target.value) })}
          className="border rounded p-1 text-sm"
        />
        <button onClick={onSave} className="px-2 py-1 bg-green-600 text-white rounded text-xs">
          Save
        </button>
        <button onClick={onCancel} className="px-2 py-1 bg-gray-300 text-xs rounded">
          Cancel
        </button>
      </div>
    );
  }

  // Display price safely even if it's a string
  const displayPrice =
    typeof tier.price === "number"
      ? tier.price.toFixed(2)
      : Number(tier.price).toFixed(2);

  return (
    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">  
      <span className="text-sm">{tier.threshold}</span>
      <span className="text-sm">${displayPrice}</span>
      <button
        onClick={onEdit}
        disabled={disabled}
        className={`px-2 py-1 rounded text-xs ${
          disabled ? "bg-gray-200 text-gray-400" : "bg-blue-600 text-white"
        }`}
      >
        {adding ? "Add" : "Edit"}
      </button>
      {!adding && (
        <button
          onClick={onDelete}
          disabled={disabled}
          className={`px-2 py-1 rounded text-xs ${
            disabled ? "bg-gray-200 text-gray-400" : "bg-red-600 text-white"
          }`}
        >
          Delete
        </button>
      )}
    </div>
  );
}
