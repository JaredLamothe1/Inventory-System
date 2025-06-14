import React from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import Layout from "./components/Layout";

import Dashboard from "./components/dashboard";
import ProductList from "./components/ProductList";
import PurchaseOrdersPage from "./components/PurchaseOrdersPage";
import Analytics from "./components/Analytics";
import ProductDetails from "./components/ProductDetails";
import AddPurchaseOrderForm from "./components/AddPurchaseOrderForm";
import PurchaseOrderDetails from './components/PurchaseOrderDetails';

import SalesPage from './components/SalesPage';
import AddSaleForm from './components/AddSaleForm';
import SaleDetails from './components/SaleDetails';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/:id" element={<ProductDetails />} />
          <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="/purchase-orders/:id" element={<PurchaseOrderDetails />} />
          <Route path="/Analytics" element={<Analytics/>} />

          {/* 🔥 New Sales Routes */}
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/sales/:id" element={<SaleDetails />} />
          

        </Route>

        {/* Standalone forms */}
        <Route path="/add-purchase-order" element={<AddPurchaseOrderForm />} />
        <Route path="/sales/new" element={<AddSaleForm />} />
      </Routes>
    </Router>
  );
};

export default App;
