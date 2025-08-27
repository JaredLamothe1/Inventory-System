import React from "react";
import { CategoryNode } from "./CategoryTree";

type Props = {
  tree: CategoryNode[];
  value: number | null;
  onChange: (id: number | null) => void;
  allowNone?: boolean;
};

export default function CategoryPicker({ tree, value, onChange, allowNone = true }: Props) {
  const flat: { id: number | null; label: string }[] = [];
  const walk = (n: CategoryNode[], prefix = "") => {
    n.forEach((c) => {
      flat.push({ id: c.id, label: prefix + c.name });
      walk(c.children, prefix + "— ");
    });
  };
  walk(tree);

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {allowNone && <option value="">(No category)</option>}
      {flat.map((r) => (
        <option key={r.id ?? "none"} value={r.id ?? ""}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
