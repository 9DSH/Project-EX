import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import AdminLayout from "./layout/AdminLayout";
import MyAccount from "./pages/MyAccount";

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
  // "landing" -> "login" -> logged in. Skipped entirely if a token already
  // exists (e.g. page refresh while logged in).
  const [stage, setStage] = useState(logged ? "app" : "landing");
  // True only when arriving at "landing" by going *back* from Login — tells
  // Landing to play the reverse tunnel (start warped/huge, shrink to rest)
  // instead of its normal quiet fade-in.
  const [reverseEntry, setReverseEntry] = useState(false);

  if (stage === "landing") {
    return (
      <Landing
        onEnter={() => setStage("login")}
        reverseEntry={reverseEntry}
      />
    );
  }

  if (!logged) {
    return (
      <Login
        onLogin={() => { setLogged(true); setStage("app"); }}
        onBack={() => {
          setReverseEntry(true);
          setStage("landing");
        }}
      />
    );
  }

  return (
    <BrowserRouter>
      <AdminLayout>
        <Routes>

          {/* DASHBOARD */}
          <Route path="/" element={<MyAccount />} />
          <Route path="/overview" element={<MyAccount />} />
          <Route path="/my_account" element={<MyAccount />} />


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