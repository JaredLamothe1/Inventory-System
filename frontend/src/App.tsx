import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";

import Dashboard from "./components/dashboard";
import ProductList from "./components/ProductList";
import ProductDetails from "./components/ProductDetails";
import PurchaseOrdersPage from "./components/PurchaseOrdersPage";
import PurchaseOrderDetails from "./components/PurchaseOrderDetails";
import AddPurchaseOrderForm from "./components/AddPurchaseOrderForm";
import SalesPage from "./components/SalesPage";
import SaleDetails from "./components/SaleDetails";
import AddSaleForm from "./components/AddSaleForm";
import Analytics from "./components/Analytics";

import Login from "./pages/Login";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import AccountPage from "./pages/AccountPage";
import CategoryManager from "./pages/CategoryManager";
const App = () => (
  <Router>
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected */}
      <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
        <Route index element={<Navigate to="dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* Products */}
        <Route path="products" element={<ProductList />} />
        <Route path="products/:id" element={<ProductDetails />} />
        <Route path="products/categories" element={<CategoryManager />} />  {/* <-- add this */}

        {/* The rest */}
        <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="purchase-orders/:id" element={<PurchaseOrderDetails />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="sales/:id" element={<SaleDetails />} />
        <Route path="sales/edit/:saleId" element={<AddSaleForm />} />
        <Route path="change-password" element={<ChangePasswordPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>

      /* Optional: keep these if you really need them outside Layout */
      <Route path="add-purchase-order" element={<AddPurchaseOrderForm />} />
      <Route path="sales/new" element={<AddSaleForm />} />


        {/* If you truly need these two outside the sidebar */}
        <Route path="add-purchase-order" element={<AddPurchaseOrderForm />} />
        <Route path="sales/new" element={<AddSaleForm />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </Router>
);

export default App;
