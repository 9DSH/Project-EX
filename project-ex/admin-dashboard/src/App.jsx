import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import AdminLayout from "./layout/AdminLayout";

import Overview from "./pages/Overview";
import Users from "./pages/Users";
import ProductsManagement  from "./pages/ProductsManagement";
import OrdersManagement from "./pages/OrdersManagement";
import Transactions from "./pages/Transactions";
import MessagesPage from "./pages/MessagesPage";
import Withdraws from "./pages/Withdraws";
import AssetManager from "./pages/AssetManager"; 
import ExchangeDashboard from "./pages/ExchangeDashboard";
import WireTransferDashboard from "./pages/WireTransferDashboard";
import TelegramManagement from "./pages/TelegramManagement";

export default function App() {
  const [logged, setLogged] = useState(
    !!localStorage.getItem("token")
  );

  if (!logged) {
    return <Login onLogin={() => setLogged(true)} />;
  }

  return (
    <BrowserRouter>
      <AdminLayout>
        <Routes>

          {/* DASHBOARD */}
          <Route path="/" element={<Overview />} />

          {/* USERS */}
          <Route path="/users" element={<Users />} />

          {/* SERVICES */}
          <Route path="/ProductsManagement" element={<ProductsManagement/>} />

          {/* ORDERS */}
          <Route path="/OrdersManagement" element={<OrdersManagement />} />

          {/* TRANSACTIONS */}
          <Route path="/transactions" element={<Transactions />} />

          {/* AssetManager */}
          <Route path="/asset_manager" element={<AssetManager />} />

          {/* Exchange */}
          <Route path="/exchange_dashboard" element={<ExchangeDashboard />} />

          {/* Wire Transfer */}
          <Route path="/wire_transfer" element={<WireTransferDashboard />} />

          {/* Admin Profile */}
         
          <Route path="/telegram_management" element={<TelegramManagement />} />
          {/* MESSAGES (NEW FEATURE) */}
          <Route path="/messages" element={<MessagesPage />} />

          <Route path="/withdraws" element={<Withdraws />} />

        </Routes>
      </AdminLayout>
    </BrowserRouter>
  );
}