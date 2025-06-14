import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Package, BarChart3, Home, ShoppingCart } from "lucide-react";

const Layout = () => {
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: <Home className="w-5 h-5" /> },
    { name: "Products", path: "/products", icon: <Package className="w-5 h-5" /> },
    { name: "Purchase Orders", path: "/purchase-orders", icon: <ShoppingCart className="w-5 h-5" /> },
    { name: "Sales", path: "/sales", icon: <BarChart3 className="w-5 h-5" /> },
    { name: "Analytics", path: "/analytics", icon: <BarChart3 className="w-5 h-5" /> },
  ];

  // Routes where sidebar should be hidden
  const hideSidebar = ["/sales/new", "/add-purchase-order"].includes(location.pathname);

  return (
    <div className="flex min-h-screen bg-gray-100 text-gray-800">
      {/* Sidebar */}
      {!hideSidebar && (
        <aside className="w-64 bg-white border-r shadow-md p-4 flex flex-col">
          <h1 className="text-2xl font-extrabold mb-8 text-center text-blue-700 tracking-tight">
            AcuTrack
          </h1>
          <nav className="space-y-2 text-base">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-2 rounded-md transition-all
                  ${
                    location.pathname === item.path
                      ? "bg-blue-100 text-blue-700 font-semibold"
                      : "hover:bg-gray-100"
                  }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>
        </aside>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="bg-white shadow-md px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-blue-800">Inventory Management</h2>
        </header>

        {/* Routed page content */}
        <main className="flex-1 p-6 overflow-y-auto bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
