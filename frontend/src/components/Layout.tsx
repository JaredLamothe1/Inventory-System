// src/layout/Layout.tsx
import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Home,
  Package,
  ShoppingCart,
  BarChart3,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import useAuth from "@/hooks/useAuth";

type NavLeaf = {
  name: string;
  path: string;
};

type NavGroup = {
  name: string;
  icon: ReactNode;
  children: NavLeaf[];
};

type SingleNav = {
  name: string;
  path: string;
  icon: ReactNode;
  hideWhenLoggedOut?: boolean;
};

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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Products: true,
  });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
      isActive
        ? "bg-blue-600 text-white"
        : "text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
    }`;

  const toggleGroup = (name: string) =>
    setExpandedGroups((prev) => ({ ...prev, [name]: !prev[name] }));

  const isGroup = (item: NavItem): item is NavGroup => (item as NavGroup).children !== undefined;

  return (
    <div className="min-h-screen flex bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`fixed z-30 inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
          <span className="font-semibold text-lg text-gray-800 dark:text-gray-100">AcuTrack</span>
          <button
            className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto">
          {navItems
            .filter((i) => ("hideWhenLoggedOut" in i ? isAuthenticated : true))
            .map((item) =>
              isGroup(item) ? (
                <div key={item.name}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    onClick={() => toggleGroup(item.name)}
                  >
                    {expandedGroups[item.name] ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    {item.icon}
                    <span>{item.name}</span>
                  </button>
                  {expandedGroups[item.name] &&
                  item.children.map((child) => {
                    const exact = child.path === "/products"; // only this one needs exact match
                    return (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        end={exact}
                        className={linkClasses}
                        onClick={() => setOpen(false)}
                      >
                        <span className="pl-8">{child.name}</span>
                      </NavLink>
                    );
                  })}
                </div>
              ) : (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={linkClasses}
                  onClick={() => setOpen(false)}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </NavLink>
              )
            )}

          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="mt-4 flex items-center gap-3 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-md transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          )}
        </nav>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 shadow flex items-center px-4 justify-between z-20">
        <button
          className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-semibold text-gray-800 dark:text-gray-100">AcuTrack</span>
        <div className="w-6 h-6" /> {/* spacer */}
      </div>

      {/* Content */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
