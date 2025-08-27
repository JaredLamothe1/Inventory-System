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
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-600 to-indigo-600" />
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Plus className="w-4 h-4" /> New Category
        </button>
      </div>

      {/* Message */}
      {msg && (
        <p className={`${msg.isError ? "text-red-600" : "text-green-600"} mb-4`}>
          {msg.text}
        </p>
      )}

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_140px_160px] items-center gap-4 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
          <div>Category</div>
          <div className="text-right"># Products</div>
          <div className="text-right">Actions</div>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-slate-500">Loading…</div>
        ) : categories.length === 0 ? (
          <div className="px-4 py-6 text-slate-500">No categories yet.</div>
        ) : (
          categories.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[1fr_140px_160px] items-center gap-4 px-4 py-3 text-sm hover:bg-slate-50"
            >
              <div className="truncate" title={c.name}>
                {c.name}
              </div>
              <div className="text-right text-slate-500">
                {typeof (c as any).product_count === "number"
                  ? (c as any).product_count
                  : "—"}
              </div>
              <div className="flex justify-end gap-2 text-slate-600">
                <button
                  onClick={() => openEdit(c.id)}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2.5 py-1.5 text-xs hover:bg-slate-100"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="inline-flex items-center justify-center rounded-md border border-red-300 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal title={editId ? "Edit Category" : "New Category"} onClose={() => setShowModal(false)}>
          {modalLoading ? (
            <p className="text-slate-600">Loading…</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4 text-sm">
              <div>
                <label className="mb-1 block font-medium">Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-600">Default Sale Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formSalePrice}
                    onChange={(e) => setFormSalePrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600">Default Purchase Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formBasePurchasePrice}
                    onChange={(e) => setFormBasePurchasePrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="optional"
                  />
                </div>
              </div>

              {/* Tiers */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Purchase Tiers</span>
                  <button
                    type="button"
                    onClick={startAddTier}
                    disabled={editingTierIdx !== null}
                    className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-slate-300"
                  >
                    + Add
                  </button>
                </div>

                <div className="space-y-2">
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
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
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
          <p className="mb-4 text-sm text-slate-700">
            You changed this category’s default sale and/or purchase prices. How should existing products be updated?
          </p>
          <div className="flex justify-end gap-2">
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              onClick={() => submitToServer(pendingPayload)}
            >
              No cascade
            </button>
            <button
              className="rounded-lg border border-blue-600 bg-white px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50"
              onClick={() =>
                submitToServer({
                  ...pendingPayload,
                  propagate_sale_price: true,
                  propagate_purchase_cost: true,
                })
              }
            >
              Update non-overridden only
            </button>
            <button
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              onClick={() =>
                submitToServer({ ...pendingPayload, propagate_prices: true })
              }
            >
              Override all products
            </button>
          </div>
        </Modal>
      )}

      {loading && <div className="sr-only" aria-live="polite">Loading categories…</div>}
    </div>
  );
}

/* -------- Subcomponents -------- */
type ModalProps = { title: string; children: React.ReactNode; onClose: () => void };
const Modal = ({ title, children, onClose }: ModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <button
        onClick={onClose}
        className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Close"
      >
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
      <div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 rounded bg-slate-50 p-2">
        <input
          type="number"
          min={1}
          value={tier.threshold}
          onChange={(e) => onChangeDraft?.({ ...tier, threshold: Number(e.target.value) })}
          className="rounded border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="number"
          min={0}
          step="0.01"
          value={tier.price}
          onChange={(e) => onChangeDraft?.({ ...tier, price: Number(e.target.value) })}
          className="rounded border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={onSave} className="rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700">
          Save
        </button>
        <button onClick={onCancel} className="rounded bg-slate-300 px-3 py-1.5 text-xs hover:bg-slate-400">
          Cancel
        </button>
      </div>
    );
  }

  const displayPrice =
    typeof tier.price === "number"
      ? tier.price.toFixed(2)
      : Number(tier.price).toFixed(2);

  return (
    <div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
      <span className="text-sm">{tier.threshold}</span>
      <span className="text-sm">${displayPrice}</span>
      <button
        onClick={onEdit}
        disabled={!!disabled}
        className={`rounded px-3 py-1.5 text-xs ${
          disabled ? "bg-slate-200 text-slate-400" : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {adding ? "Add" : "Edit"}
      </button>
      {!adding && (
        <button
          onClick={onDelete}
          disabled={!!disabled}
          className={`rounded px-3 py-1.5 text-xs ${
            disabled ? "bg-slate-200 text-slate-400" : "bg-red-600 text-white hover:bg-red-700"
          }`}
        >
          Delete
        </button>
      )}
    </div>
  );
}
