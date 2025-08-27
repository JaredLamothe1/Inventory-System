import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

export type CategoryNode = {
  id: number;
  name: string;
  default_sale_price?: number | null;
  parent_id?: number | null;
  children: CategoryNode[];
};

type Props = {
  tree: CategoryNode[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  showAll?: boolean;
};

export default function CategoryTree({ tree, selected, onSelect, showAll = true }: Props) {
  return (
    <div className="space-y-1 text-sm">
      {showAll && (
        <button
          className={[
            "block w-full text-left px-2 py-1 rounded",
            selected === null ? "bg-blue-600 text-white" : "hover:bg-slate-100 text-slate-700",
          ].join(" ")}
          onClick={() => onSelect(null)}
        >
          All
        </button>
      )}
      {tree.map((n) => (
        <Node key={n.id} node={n} depth={0} selected={selected} onSelect={onSelect} />
      ))}
    </div>
  );
}

function Node({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: CategoryNode;
  depth: number;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={[
          "flex items-center gap-1 px-2 py-1 rounded cursor-pointer",
          selected === node.id ? "bg-blue-600 text-white" : "hover:bg-slate-100 text-slate-800",
        ].join(" ")}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren && (
          <button
            type="button"
            className="mr-1 inline-flex items-center justify-center rounded hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
        <span className="truncate">{node.name}</span>
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
