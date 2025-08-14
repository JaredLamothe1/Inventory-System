import React from "react";
import { X } from "lucide-react";

export type PurchaseTier = {
  id?: number;            // present on existing tiers
  threshold: number;
  price: number;
};

type Props = {
  value: PurchaseTier[];
  onChange: (tiers: PurchaseTier[]) => void;
};

export default function PurchaseTierEditor({ value, onChange }: Props) {
  const update = (idx: number, patch: Partial<PurchaseTier>) => {
    const next = [...value];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const remove = (idx: number) => {
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  };

  const add = () => {
    onChange([...value, { threshold: 1, price: 0 }]);
  };

  // Optional: enforce sorted display
  const tiers = [...value].sort((a, b) => a.threshold - b.threshold);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Purchase Price Tiers</h4>
        <button
          type="button"
          onClick={add}
          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add tier
        </button>
      </div>

      {tiers.length === 0 && (
        <p className="text-xs text-gray-500">No tiers. The base purchase price will be used.</p>
      )}

      {tiers.map((t, i) => (
        <div
          key={t.id ?? `new-${i}`}
          className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
        >
          <input
            type="number"
            min={1}
            step={1}
            className="border rounded px-2 py-1 text-sm"
            value={t.threshold}
            onChange={(e) => update(i, { threshold: Number(e.target.value) })}
            placeholder="Threshold qty"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            className="border rounded px-2 py-1 text-sm"
            value={t.price}
            onChange={(e) => update(i, { price: Number(e.target.value) })}
            placeholder="Price"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="p-1 text-gray-500 hover:text-red-600"
            aria-label="Remove tier"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
