// src/App.tsx
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
      {/* Public routes (no auth required) */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected routes */}
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Products */}
          <Route path="products" element={<ProductList />} />
          <Route path="products/:id" element={<ProductDetails />} />
          <Route path="products/categories" element={<CategoryManager />} />

          {/* Purchase Orders */}
          <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="purchase-orders/:id" element={<PurchaseOrderDetails />} />
          <Route path="purchase-orders/new" element={<AddPurchaseOrderForm />} />
          <Route path="purchase-orders/:id/edit" element={<AddPurchaseOrderForm />} />

          {/* Sales */}
          <Route path="sales" element={<SalesPage />} />
          <Route path="sales/:id" element={<SaleDetails />} />
          <Route path="sales/new" element={<AddSaleForm />} />
          <Route path="sales/edit/:saleId" element={<AddSaleForm />} />

          {/* Other */}
          <Route path="analytics" element={<Analytics />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
        </Route>
      </Route>

      {/* Catch-all: if unauth, go to /login; if authed, go to /dashboard */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </Router>
);

export default App;
