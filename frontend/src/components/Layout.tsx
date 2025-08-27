// src/layout/Layout.tsx
import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Home, Package, ShoppingCart, BarChart3, User as UserIcon,
  LogOut, Menu, X, ChevronDown, ChevronRight
} from "lucide-react";
import useAuth from "@/hooks/useAuth";

type NavLeaf = { name: string; path: string };
type NavGroup = { name: string; icon: ReactNode; children: NavLeaf[] };
type SingleNav = { name: string; path: string; icon: ReactNode; hideWhenLoggedOut?: boolean };
type NavItem = SingleNav | NavGroup;

const navItems: NavItem[] = [
  { name: "Dashboard", path: "/dashboard", icon: <Home className="w-5 h-5" /> },
  {
    name: "Products",
    icon: <Package className="w-5 h-5" />,
    children: [
      { name: "All Products", path: "/products" },
      { name: "Categories", path: "/products/categories" },
    ],
  },
  { name: "Purchase Orders", path: "/purchase-orders", icon: <ShoppingCart className="w-5 h-5" /> },
  { name: "Sales", path: "/sales", icon: <BarChart3 className="w-5 h-5" /> },
  { name: "Analytics", path: "/analytics", icon: <BarChart3 className="w-5 h-5" /> },
  { name: "Account", path: "/account", icon: <UserIcon className="w-5 h-5" /> },
];

export default function Layout() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ Products: true });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isGroup = (item: NavItem): item is NavGroup => (item as NavGroup).children !== undefined;
  const toggleGroup = (name: string) => setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    [
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
      "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
      isActive
        ? "bg-blue-600 text-white shadow-sm"
        : "text-slate-200/90 hover:text-white hover:bg-white/10"
    ].join(" ");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden inline-flex items-center justify-center rounded-lg p-2 hover:bg-slate-100"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 font-bold">
              <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-600 to-indigo-600" />
              <span className="tracking-tight">AcuTrack</span>
            </div>
          </div>

          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white px-3 py-2 text-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-hidden={!open}
      >
        <div className="flex h-full flex-col border-r border-slate-200 bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100">
          <div className="h-14 flex items-center justify-between px-4 lg:hidden">
            <span className="font-semibold">Navigation</span>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 hover:bg-white/10"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {navItems
              .filter(i => ("hideWhenLoggedOut" in i ? isAuthenticated : true))
              .map(item =>
                isGroup(item) ? (
                  <div key={item.name} className="mb-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.name)}
                      className="w-full group flex items-center gap-3 px-3 py-2 text-xs uppercase tracking-wide text-slate-300 hover:text-white"
                    >
                      {expandedGroups[item.name] ? (
                        <ChevronDown className="w-4 h-4 opacity-80" />
                      ) : (
                        <ChevronRight className="w-4 h-4 opacity-80" />
                      )}
                      {item.icon}
                      <span>{item.name}</span>
                    </button>
                    {expandedGroups[item.name] && (
                      <div className="mt-1 space-y-1 pl-8">
                        {item.children.map(child => (
                          <NavLink key={child.path} to={child.path} className={linkClasses} end={child.path === "/products"}>
                            <span className="truncate">{child.name}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <NavLink key={item.path} to={item.path} className={linkClasses}>
                    {item.icon}
                    <span className="truncate">{item.name}</span>
                  </NavLink>
                )
              )}
          </nav>

          {/* Sidebar footer: brand (left) + Logout (right) for mobile/compact use */}
          <footer className="border-t border-white/10 p-4 flex items-center justify-between text-xs text-slate-300/80">
            <span>© {new Date().getFullYear()} AcuTrack</span>
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 bg-white/10 hover:bg-white/20"
                aria-label="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            )}
          </footer>
        </div>
      </aside>

      {/* Page content */}
      <main className="lg:pl-72">
        <div className="mx-auto max-w-7xl p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
