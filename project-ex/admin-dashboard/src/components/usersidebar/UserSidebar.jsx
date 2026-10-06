import { useEffect, useState, useCallback, useRef,  useMemo } from "react";
import { createPortal } from "react-dom";
import { API_URL } from "../../config";
import ACCESS_OPTIONS, { ACCESS_GROUPS } from "../../constants/AccessPoints";
import ChatWindow from "../ChatWindow";
import ProfileTab from "./ProfileTab";
import WalletTab from "./WalletTab";
import OrdersTab from "./OrdersTab";
import TransactionsTab from "./TransactionsTab";
import { hasPermission } from "../../utils/permissions";
import PermissionGate from "../PermissionGate";
import "./UserSidebar.css";
import {
  User,
  Wallet,
  ShoppingCart,
  Package,
  Receipt,
  MessageSquare,
  UsersRound,
} from "lucide-react";

const TABS = [
  { key: "profile", label: "Profile", Icon: User },
  { key: "wallet", label: "Wallet", Icon: Wallet },
  { key: "orders", label: "Orders", Icon: ShoppingCart },
  { key: "transactions", label: "Transactions", Icon: Receipt },
  { key: "messages", label: "Messages", Icon: MessageSquare },
];

function calculateProductPricing(product,  targetUser, bonusPercent = 0) {
  const originalPrice = Number(product.price || 0);
  const userOwner = targetUser?.admin_username
  let current = originalPrice;
  let finalForUser = originalPrice;
  const steps = [];

  // Product Discount
  if (product.discount_percent) {
    const percent = Number(product.discount_percent);
    const deducted = current * (percent / 100);


    current -= deducted;
    finalForUser -= deducted
    steps.push({
      label: "Product Discount",
      percent,
      deducted,
      remaining: current,
      color: "#f59e0b",
    });
  }

  // System Commission
  if (product.system_commision) {
    const percent = Number(product.system_commision);
    const deducted = current * (percent / 100);

    current -= deducted;

    steps.push({
      label: "System Commission",
      percent,
      deducted,
      remaining: current,
      color: "#e2e8f08e",
    });
  }

  // System Reward
    if (
      product.system_reward_percent &&
      targetUser &&
      targetUser.admin_id !== product.admin_id
    ) {
    const percent = Number(product.system_reward_percent);
    const deducted = current * (percent / 100);

    current -= deducted;

    steps.push({
      label: "System Reward",
      percent,
      deducted,
      remaining: current,
      color: "#e2e8f08e",
    });
  }

  // Admin Bonus
  if (bonusPercent) {
    const percent = Number(bonusPercent);
    const deducted = current * (percent / 100);

    current -= deducted;
    finalForUser -= deducted
    steps.push({
      label: "Admin Bonus",
      percent,
      deducted,
      remaining: current,
      color: "#818cf8",
    });
  }

  const finalDue = current;

  const totalSaved = originalPrice - finalDue;

  const effectiveDiscount =
    originalPrice > 0
      ? (totalSaved / originalPrice) * 100
      : 0;

  return {
    originalPrice,
    finalDue,
    finalForUser,
    totalSaved,
    effectiveDiscount,
    steps,
    userOwner
  };
}


// ─── tiny debounce hook ───────────────────────────────────────────────────────
function useDebounce(fn, delay = 350) {
  const timer = useRef(null);
  return useCallback(
    (...args) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay]
  );
}



export default function UserSidebar({ user, onClose, onRefresh }) {
  // =====================================================
  // STATES
  // =====================================================
  const [tab, setTab] = useState("profile");
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("active");
  const [role, setRole] = useState("user");
  const [telegramId, setTelegramId] = useState("");
  const [accessPoints, setAccessPoints] = useState([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [withdrawalWallet, setWithdrawalWallet] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [permissionTab, setPermissionTab] = useState("basic");

  const [balanceAction, setBalanceAction] = useState("deposit");
  const [balance, setBalance] = useState("");

  const [currencies, setCurrencies] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [balanceOpen, setBalanceOpen] = useState(false);

  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState("");

  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);

  const [activeChat, setActiveChat] = useState(null);

  const token = localStorage.getItem("token");

  const [orderSubTab, setOrderSubTab] = useState("products");
  
  const [createOrderOpen, setCreateOrderOpen] = useState(false);

  const [productCategories, setProductCategories] = useState([]);
  const [products, setProducts] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");

  const [creatingOrder, setCreatingOrder] = useState(false);
  const [bonusPercent, setBonusPercent] = useState(""); 
  const [inputDataText, setInputDataText] = useState({});

  const [exchangeOrders, setExchangeOrders] = useState([]);
  const [currencyExchangeFrom, setCurrencyExchangeFrom] = useState("");
  const [currencyExchangeTo, setCurrencyExchangeTo] = useState("");
  const [networkExchangeFrom, setNetworkExchangeFrom] = useState("");
  const [networkExchangeTo, setNetworkExchangeTo] = useState("");
  const [exchangeAmount, setExchangeAmount] = useState("");

  const [exchangePreview, setExchangePreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [executingExchange, setExecutingExchange] = useState(false);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [exchangePairs, setExchangePairs] = useState([]);

  const [customRate, setCustomRate] = useState("");
  const [selectedPairData, setSelectedPairData] = useState(null);
  const [liveRate, setLiveRate] = useState(null);
  const [loadingRate, setLoadingRate] = useState(false);

  const [loadingExchangeOrders, setLoadingExchangeOrders] = useState(false);

  const [visible, setVisible] = useState(false);

  // =====================================================
  // INTERNAL TRANSFER STATES
  // =====================================================
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferCurrency, setTransferCurrency] = useState("");
  const [transferNetwork, setTransferNetwork] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferSearch, setTransferSearch] = useState("");
  const [transferResults, setTransferResults] = useState([]);
  const [transferSearchLoading, setTransferSearchLoading] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(null);
  const [transferError, setTransferError] = useState(null);


  const currentUser = {
        role: localStorage.getItem("role"),
        access_points: JSON.parse(localStorage.getItem("access_points") || "[]")
      };
  

  const permissions = useMemo(() => ({
    canViewOrders: hasPermission(currentUser, "orders.view"),
    canManageOrders: hasPermission(currentUser, "orders.manage"),
    canViewExchange: hasPermission(currentUser, "exchange.view"),
    canManageExchange: hasPermission(currentUser, "exchange.service"),
    canEditUser: hasPermission(currentUser, "users.manage"),
    canDeleteUser: hasPermission(currentUser, "users.delete"),
  }), [currentUser]);


 

  // =====================================================
  // INIT
  // =====================================================
  useEffect(() => {
    if (!user) return;
    setUsername(user.username || "");
    setStatus(user.status || "active");
    setRole(user.role || "user");
    setTelegramId(user.telegram_id || "");
    setFirstName(user.first_name ?? "");
    setLastName(user.last_name ?? "");
    setPhoneNumber(user.phone_number ?? "");
    setEmail(user.email ?? "");
    setWithdrawalWallet(user.withdrawal_wallet ?? "");
    setNewPassword("");

    setAccessPoints(user.access_points || []);

    loadMeta();
    loadOrders();
    loadTransactions();
    loadExchangeOrders();

  }, [user]);

  useEffect(() => {
      // open animation on mount
      requestAnimationFrame(() => setVisible(true));
    }, []);

    const handleClose = () => {
      setVisible(false);
      setTimeout(() => {
        onClose?.();
      }, 250); // match animation duration
    };

  // =====================================================
  // INIT CHAT
  // =====================================================
  useEffect(() => {
    if (!user) return;

    const initConversation = async () => {
      try {
        const res = await fetch(
          `${API_URL}/admin/messages/start?user_id=${user.user_id}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();

        setActiveChat({
          conversation_id: data.conversation_id,
          user_id: user.user_id,
          username: user.username,
        });
      } catch (err) {
        console.error(err);
      }
    };

    initConversation();
  }, [user?.user_id]);

  // =====================================================
  // LOAD META
  // =====================================================
  const loadMeta = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [c, n, p, ep] = await Promise.all([
        fetch(`${API_URL}/admin/currencies/`, { headers }).then((r) => r.json()),
        fetch(`${API_URL}/admin/networks/`, { headers }).then((r) => r.json()),
        fetch(`${API_URL}/admin/currency-networks/`, { headers }).then((r) => r.json()),
        fetch(`${API_URL}/admin/exchange/`, { headers }).then((r) => r.json()),
      ]);

      const cat = await fetch(`${API_URL}/admin/categories/`, { headers }).then((r) => r.json());

      setProductCategories(Array.isArray(cat) ? cat : []);
      setCurrencies(Array.isArray(c) ? c : []);
      setNetworks(Array.isArray(n) ? n : []);
      setPairs(Array.isArray(p) ? p : []);
      setExchangePairs(Array.isArray(ep) ? ep : []);
    } catch (err) {
      console.error("Meta load error:", err);
    }
  };

  // =====================================================
  // LOAD ORDERS
  // =====================================================
  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch(
        `${API_URL}/admin/users/${user.user_id}/orders`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // =====================================================
  // LOAD EXCHANGE ORDERS
  // =====================================================
  const loadExchangeOrders = async () => {
    if (!user?.user_id) return;

    setLoadingExchangeOrders(true);

    try {
      const res = await fetch(
        `${API_URL}/admin/exchange/users/${user.user_id}/orders`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setExchangeOrders(Array.isArray(data) ? data : []);
      } else {
        setExchangeOrders([]);
      }
    } catch (err) {
      console.error("Failed to load exchange orders:", err);
      setExchangeOrders([]);
    } finally {
      setLoadingExchangeOrders(false);
    }
  };

   // ------- acess point --------------------------------
  const toggleAccess = (access) => {
      setAccessPoints(prev =>
        prev.includes(access)
          ? prev.filter(x => x !== access)
          : [...prev, access]
      );
    };

  // =====================================================
  // LOAD TX for Products
  // =====================================================
  const loadTransactions = async () => {
    setLoadingTx(true);

    try {
      const res = await fetch(
        `${API_URL}/admin/users/${user.user_id}/transactions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      console.log("trasnactions UI data:", data)
      if (res.ok) {
        setTransactions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTx(false);
    }
  };

  // ====================================================
  // Load Products by cat
  // ====================================================
  const loadProductsByCategory = async (categoryId) => {
    if (!categoryId) return;

    try {
      const res = await fetch(
        `${API_URL}/admin/products/by-category/${categoryId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        console.error("Failed loading products", res.status, await res.text());
        setProducts([]);
        return;
      }

      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed loading products", err);
      setProducts([]);
    }
  };

  // ===================================================
  // Create Order For User
  // ===================================================
  const createOrderForUser = async () => {
    if (!selectedProduct) {
      alert("Select product");
      return;
    }

    setCreatingOrder(true);
    console.log("input", inputDataText)
    let safeInputData = inputDataText;

    if (typeof inputDataText === "string") {
      try {
        safeInputData = JSON.parse(inputDataText);
      } catch {
        safeInputData = {};
      }
    }

    
    try {
      const res = await fetch(
        `${API_URL}/admin/orders/create`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            user_id: Number(user.user_id),
            product_id: Number(selectedProduct),
            bonus_percent: bonusPercent ? Number(bonusPercent) : null,
            input_data:
                safeInputData && Object.keys(safeInputData).length > 0
                  ? safeInputData
                  : null,
          }),
        }
      );
      
      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Failed to create order");
        return;
      }

      alert("Order created successfully");

      setCreateOrderOpen(false);
      setSelectedCategory("");
      setSelectedProduct("");
      setBonusPercent(""); 
      setInputDataText({});

      loadOrders();
      onRefresh?.();

    } catch (err) {
      console.error("Create order error:", err);
      alert("Failed to create order");
    } finally {
      setCreatingOrder(false);
    }
  };

// =====================================================
  // EXCHANGE — available networks for From currency
  // =====================================================
  const exchangeFromCurrencyId = currencies.find(
    (c) => c.symbol === currencyExchangeFrom
  )?.id;

  const exchangeFromNetworks = pairs
    .filter((p) => p.currency?.id === Number(exchangeFromCurrencyId))
    .map((p) => p.network)
    .filter(Boolean);

  const fromNetworkRequired = exchangeFromNetworks.length > 0;

  // =====================================================
  // EXCHANGE — available networks for To currency
  // =====================================================
  const exchangeToCurrencyId = currencies.find(
    (c) => c.symbol === currencyExchangeTo
  )?.id;

  const exchangeToNetworks = pairs
    .filter((p) => p.currency?.id === Number(exchangeToCurrencyId))
    .map((p) => p.network)
    .filter(Boolean);

  const toNetworkRequired = exchangeToNetworks.length > 0;
  // =====================================================
  // FILTER NETWORKS
  // =====================================================
  
  const availableNetworks = pairs
    .filter((p) => p.currency?.id === Number(selectedCurrency))
    .map((p) => p.network)
    .filter(Boolean);

  const balanceRequiresNetwork =
    availableNetworks.length > 0;

  // Transfer-specific available networks
  const transferAvailableNetworks = pairs
        .filter((p) => p.currency?.id === Number(transferCurrency))
        .map((p) => p.network)
        .filter(Boolean);

  const transferRequiresNetwork =
    transferAvailableNetworks.length > 0;

  // =====================================================
  // UPDATE PROFILE
  // =====================================================
  const updateProfile = async () => {

    console.log("SENDING ACCESS POINTS:", accessPoints);
    try {
      const res = await fetch(
        `${API_URL}/admin/users/${user.user_id}/update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            username,
            status,
            role,
            telegram_id: telegramId,

            first_name: firstName,
            last_name: lastName,
            phone_number: phoneNumber,
            email,
            withdrawal_wallet: withdrawalWallet,
            access_points: accessPoints,
          }),
        }
      );

      const data = await res.json();
      console.log("UPDATE RESPONSE:", data);

      if (!res.ok) {
        alert(data.detail || "Update failed");
        return;
      }

      alert("User updated");

      onRefresh?.();
    } catch (err) {
      console.error(err);
    }
  };

  const resetPassword = async (newPassword = null) => {
    if (!user?.user_id) return;

    const confirm = window.confirm(
      "Are you sure you want to reset this user's password?"
    );

    if (!confirm) return;

    try {
      const res = await fetch(
        `${API_URL}/admin/users/${user.user_id}/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            new_password: newPassword || null,
          }),
        }
      );

      const data = await res.json();


      if (!res.ok) {
        alert(data.detail || "Failed to reset password");
        return;
      }

      alert(
        `Password reset successfully.\nTemporary password: ${data.new_password}`
      );

    } catch (err) {
      console.error(err);
      alert("Network error while resetting password");
    }
  };

  // =====================================================
  // DELETE USER
  // =====================================================
  const [deletingUser, setDeletingUser] = useState(false);

  const deleteUser = async () => {
    if (!user?.user_id) return;

    if (user.role === "master") {
      alert("Master accounts cannot be deleted here.");
      return;
    }

    const confirmStep1 = window.confirm(
      `Are you sure you want to delete user "${user.username}" (#${user.user_id})?\n\nThis action cannot be undone.`
    );
    if (!confirmStep1) return;

    const typed = window.prompt(
      `To confirm, type the username "${user.username}" exactly:`
    );
    if (typed !== user.username) {
      if (typed !== null) alert("Username didn't match. Deletion cancelled.");
      return;
    }

    setDeletingUser(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${user.user_id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.detail || "Failed to delete user");
        return;
      }

      alert(data.message || "User deleted");
      onRefresh?.();
      handleClose();
    } catch (err) {
      console.error(err);
      alert("Network error while deleting user");
    } finally {
      setDeletingUser(false);
    }
  };

  // =====================================================
  // BALANCE ACTION
  // =====================================================
  const updateBalance = async () => {
    if (!selectedCurrency) {
      alert("Select currency");
      return;
    }

    if (balanceRequiresNetwork && !selectedNetwork) {
      alert("Select network");
      return;
    }

    if (!balance) {
      alert("Enter amount");
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/admin/users/${user.user_id}/balance`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            amount: Number(balance),
            action: balanceAction,
            currency_id: Number(selectedCurrency),
            network_id: balanceRequiresNetwork
                    ? Number(selectedNetwork)
                    : null,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Balance update failed");
        return;
      }

      alert("Balance updated");

      setBalance("");

      onRefresh?.();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteBalancePair = async (balanceItem) => {
    if (!balanceItem) return;

    const available = Number(balanceItem.available || 0);
    const frozen = Number(balanceItem.frozen || 0);
    if (available !== 0 || frozen !== 0) {
      alert("Only zero balances can be deleted.");
      return;
    }

    const pairLabel = `${balanceItem.currency}${balanceItem.network_chain ? ` on ${balanceItem.network_chain}` : ""}`;
    const confirmed = window.confirm(
      `Delete ${pairLabel} from this user?\n\nThis only works for zero, unused balances and will also remove empty wallet addresses for this pair.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(
        `${API_URL}/admin/users/${user.user_id}/balance`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currency_id: Number(balanceItem.currency_id),
            network_id: balanceItem.network_id != null
              ? Number(balanceItem.network_id)
              : null,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Failed to delete balance");
        return;
      }

      alert(data.message || "Balance deleted");
      onRefresh?.();
    } catch (err) {
      console.error(err);
      alert("Network error while deleting balance");
    }
  };

  // ====================================================
  // INTERNAL TRANSFER — user search (debounced)
  // ====================================================
  const doTransferSearch = useCallback(async (q) => {
    if (!q || q.length < 1) {
      setTransferResults([]);
      return;
    }
    setTransferSearchLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/admin/users/search?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setTransferResults(
        Array.isArray(data)
          ? data.filter((u) => u.user_id !== user.user_id)
          : []
      );
    } catch {
      setTransferResults([]);
    } finally {
      setTransferSearchLoading(false);
    }
  }, [token, user?.user_id]);

  const debouncedTransferSearch = useDebounce(doTransferSearch, 350);

  const handleTransferSearchChange = (e) => {
    const q = e.target.value;
    setTransferSearch(q);
    setTransferTarget(null);
    setTransferError(null);
    setTransferSuccess(null);
    debouncedTransferSearch(q);
  };

  const selectTransferTarget = (u) => {
    setTransferTarget(u);
    setTransferSearch(u.username);
    setTransferResults([]);
  };

  // ====================================================
  // INTERNAL TRANSFER — max available
  // ====================================================
  const transferMaxAmount = (() => {
    const sym = currencies.find(
      (c) => String(c.id) === String(transferCurrency)
    )?.symbol;

    const netName = networks.find(
      (n) => String(n.id) === String(transferNetwork)
    )?.name;

    if (!sym) return 0;

    const b = user?.balances?.find((b) => {
      if (b.currency !== sym) return false;

      if (!transferRequiresNetwork) return true;

      return b.network === netName;
    });

    return Number(b?.available ?? 0);
  })();

  // ====================================================
  // INTERNAL TRANSFER — submit
  // ====================================================
  const executeTransfer = async () => {
    setTransferError(null);
    setTransferSuccess(null);

    if (!transferTarget) return setTransferError("Select a recipient.");
    if (!transferCurrency) return setTransferError("Select a currency.");
    if (transferRequiresNetwork && !transferNetwork)
                            return setTransferError("Select a network.");
    if (!transferAmount || Number(transferAmount) <= 0)
      return setTransferError("Enter a valid amount.");
    if (Number(transferAmount) > transferMaxAmount)
      return setTransferError(`Insufficient balance. Max available: ${transferMaxAmount}`);

    setTransferSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/internal-transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          from_user_id: user.user_id,
          to_user_id: transferTarget.user_id,
          currency_id: Number(transferCurrency),
          network_id: transferRequiresNetwork
                ? Number(transferNetwork)
                : null,
          amount: Number(transferAmount),
          note: transferNote || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setTransferError(data.detail || "Transfer failed.");
        return;
      }

      setTransferSuccess(
        `✅ Transferred ${Number(transferAmount).toLocaleString()} ${data.currency} to ${transferTarget.username}. New balance: ${Number(data.from_new_balance).toLocaleString()}`
      );

      // reset form
      setTransferAmount("");
      setTransferNote("");
      setTransferTarget(null);
      setTransferSearch("");
      setTransferCurrency("");
      setTransferNetwork("");

      onRefresh?.();
      loadTransactions();
    } catch {
      setTransferError("Network error. Please try again.");
    } finally {
      setTransferSubmitting(false);
    }
  };

  // ====================================================
  // Get User Balance
  // ====================================================
  const selectedFromBalance = user?.balances?.find(
    (b) => b.currency === currencyExchangeFrom
  );

  const maxExchangeable = selectedFromBalance?.available || 0;

  
// =====================================================
  // PREVIEW EXCHANGE
  // =====================================================
  const previewExchange = async () => {
    if (!currencyExchangeFrom || !currencyExchangeTo || !exchangeAmount) return;
    if (fromNetworkRequired && !networkExchangeFrom) return;
    if (toNetworkRequired && !networkExchangeTo) return;

    setLoadingPreview(true);

    try {
      const pairData = exchangePairs.find(
        (p) =>
          p.from_currency?.symbol === currencyExchangeFrom &&
          p.to_currency?.symbol === currencyExchangeTo);

      setSelectedPairData(pairData || null);

      const res = await fetch(`${API_URL}/admin/exchange/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: user.user_id,
          from_currency: currencyExchangeFrom,
          to_currency: currencyExchangeTo,
          from_network_id: networkExchangeFrom ? Number(networkExchangeFrom) : null,
          to_network_id: networkExchangeTo ? Number(networkExchangeTo) : null,
          amount: String(exchangeAmount),
          custom_rate:
            customRate !== "" && !isNaN(Number(customRate))
              ? Number(customRate)
              : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Preview failed");
        setExchangePreview(null);
        return;
      }


      setExchangePreview(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPreview(false);
    }
  };

// =====================================================
  // Execute Function for Exchange
  // =====================================================
  const executeExchange = async () => {
    if (!currencyExchangeFrom || !currencyExchangeTo || !exchangeAmount) return;

    setExecutingExchange(true);

    try {
      const res = await fetch(`${API_URL}/admin/exchange/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: user.user_id,
          from_currency: currencyExchangeFrom,
          to_currency: currencyExchangeTo,
          from_network_id: networkExchangeFrom ? Number(networkExchangeFrom) : null,
          to_network_id: networkExchangeTo ? Number(networkExchangeTo) : null,
          amount: String(exchangeAmount),
          custom_rate:
            customRate !== "" && !isNaN(Number(customRate))
              ? Number(customRate)
              : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Exchange failed");
        return;
      }

      if (data.sweep_status === "failed") {
        alert(
          `⚠️ Exchange recorded successfully, but the on-chain sweep failed.\n\n` +
          `The user's balance has been updated. Sweep can be retried manually.\n\n` +
          `Error: ${data.sweep_error}`
        );
      } else {
        alert("✅ Exchange completed successfully");
      }

      setCurrencyExchangeFrom("");
      setCurrencyExchangeTo("");
      setNetworkExchangeFrom("");
      setNetworkExchangeTo("");
      setExchangeAmount("");
      setCustomRate("");
      setExchangePreview(null);
      setSelectedPairData(null);
      loadExchangeOrders();
      setLiveRate(null);
      onRefresh?.();

    } catch (err) {
      console.error(err);
      alert("Exchange request failed");
    } finally {
      setExecutingExchange(false);
    }
  };

// =====================================================
  // Exchange Rate
  // =====================================================
  const fetchLiveRate = async (from, to, fromNetworkId = null, toNetworkId = null, custom = null) => {
    if (!from || !to) return;

    setLoadingRate(true);

    try {
      const res = await fetch(`${API_URL}/admin/exchange/rate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: user.user_id,
          from_currency: from,
          to_currency: to,
          from_network_id: fromNetworkId ? Number(fromNetworkId) : null,
          to_network_id: toNetworkId ? Number(toNetworkId) : null,
          custom_rate: custom ? Number(custom) : null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setLiveRate(data.rate);
      } else {
        setLiveRate(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRate(false);
    }
  };

  const balanceMap = (user?.balances || []).reduce((acc, b) => {
    acc[b.currency] = Number(b.available || 0);
    return acc;
  }, {});

  const formatRate = (value) => {
    const num = Number(value);
    if (!isFinite(num)) return "-";

    const abs = Math.abs(num);

    if (abs >= 1000) {
      return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 0,
      }).format(num);
    }

    if (abs >= 1) {
      return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3,
      }).format(num);
    }

    if (abs >= 0.0000001) {
      return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 6,
      }).format(num);
    }

    return num.toExponential(2);
  };

  // =====================================================
  // UI GUARD
  // =====================================================
  if (!user) return null;


  // =====================================================
  // DERIVED — transfer currency symbol for display
  // =====================================================
  const transferCurrencySymbol =
    currencies.find((c) => String(c.id) === String(transferCurrency))?.symbol ?? "";
   

  return createPortal(
    <>
      {/* OVERLAY */}
      <div className={`user-sidebar-overlay${visible ? " is-visible" : ""}`} onClick={handleClose} />

      {/* SIDEBAR — slides in from the right on desktop, rises from the
          bottom as a sheet on mobile (see UserSidebar.css) */}
      <div
        className={`user-sidebar-container${visible ? " is-visible" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="user-sidebar-header">
          <div>
            <div className="user-sidebar-user-title">{user.username}</div>
              <div className="user-sidebar-user-sub">
              USER #{user.user_id} - Created by #{user.admin_id} {user.admin_username ?? "—"} -  {" "}
              {new Date(user.created_date).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              }).replace(",", "")}
            </div>
          </div>

          <button onClick={handleClose} className="user-sidebar-close-btn">✕</button>
        </div>

        {/* TABS */}
        <div className="user-sidebar-tabs">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`user-sidebar-tab${tab === key ? " is-active" : ""}`}
              onClick={() => setTab(key)}
            >
              <Icon size={14} className="user-sidebar-tab-icon" />
              {label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="user-sidebar-content">

          {/* =====================================================
              PROFILE
          ===================================================== */}
          {tab === "profile" && (
                  <ProfileTab
                    user={user}

                    username={username}
                    setUsername={setUsername}

                    telegramId={telegramId}
                    setTelegramId={setTelegramId}

                    status={status}
                    setStatus={setStatus}

                    role={role}
                    setRole={setRole}

                    firstName={firstName}
                    setFirstName={setFirstName}

                    lastName={lastName}
                    setLastName={setLastName}

                    phoneNumber={phoneNumber}
                    setPhoneNumber={setPhoneNumber}

                    email={email}
                    setEmail={setEmail}

                    withdrawalWallet={withdrawalWallet}
                    setWithdrawalWallet={setWithdrawalWallet}

                    accessPoints={accessPoints}
                    toggleAccess={toggleAccess}

                    permissionTab={permissionTab}
                    setPermissionTab={setPermissionTab}

                    updateProfile={updateProfile}
                    resetPassword={resetPassword}
                    deleteUser={deleteUser}
                    deletingUser={deletingUser}

                    permissions={permissions}
                    ACCESS_GROUPS={ACCESS_GROUPS}
                    hasPermission={hasPermission}
                    newPassword={newPassword}
                    setNewPassword={setNewPassword}
                  />
                    )}
        

          {/* =====================================================
              WALLET TAB
          ===================================================== */}
            {tab === "wallet" && (
                        <WalletTab
                          user={user}
                          currencies={currencies}
                          networks={networks}
                          pairs={pairs}
                          balanceAction={balanceAction}
                          setBalanceAction={setBalanceAction}
                          balance={balance}
                          setBalance={setBalance}
                          selectedCurrency={selectedCurrency}
                          setSelectedCurrency={setSelectedCurrency}
                          selectedNetwork={selectedNetwork}
                          setSelectedNetwork={setSelectedNetwork}
                          balanceOpen={balanceOpen}
                          setBalanceOpen={setBalanceOpen}
                          updateBalance={updateBalance}
                          deleteBalancePair={deleteBalancePair}
                          transferOpen={transferOpen}
                          setTransferOpen={setTransferOpen}
                          transferCurrency={transferCurrency}
                          setTransferCurrency={setTransferCurrency}
                          transferNetwork={transferNetwork}
                          setTransferNetwork={setTransferNetwork}
                          transferAmount={transferAmount}
                          setTransferAmount={setTransferAmount}
                          transferNote={transferNote}
                          setTransferNote={setTransferNote}
                          transferSearch={transferSearch}
                          setTransferSearch={setTransferSearch}
                          transferResults={transferResults}
                          transferSearchLoading={transferSearchLoading}
                          transferTarget={transferTarget}
                          setTransferTarget={setTransferTarget}
                          transferError={transferError}
                          transferSuccess={transferSuccess}
                          transferSubmitting={transferSubmitting}
                          transferCurrencySymbol={transferCurrencySymbol}
                          handleTransferSearchChange={handleTransferSearchChange}
                          selectTransferTarget={selectTransferTarget}
                          executeTransfer={executeTransfer}
                          permissions={permissions}
                          hasPermission={hasPermission}
                          onRefresh={onRefresh}
                          loadTransactions={loadTransactions}
                          availableNetworks = {availableNetworks}
                          balanceRequiresNetwork = {balanceRequiresNetwork}
                          transferAvailableNetworks= {transferAvailableNetworks}
                          transferRequiresNetwork= {transferRequiresNetwork}
                          setTransferError = {setTransferError}
                          setTransferSuccess= {setTransferSuccess}
                        />
                      )}

          {/* =====================================================
              ORDERS
          ===================================================== */}
          
          {tab === "orders" && (
                      <OrdersTab
                        user={user}
                        orders={orders}
                        orderSubTab={orderSubTab}
                        setOrderSubTab={setOrderSubTab}
                        permissions={permissions}
                        hasPermission={hasPermission}
                        // Products
                        productCategories={productCategories}
                        selectedCategory={selectedCategory}
                        setSelectedCategory={setSelectedCategory}
                        products={products}
                        selectedProduct={selectedProduct}
                        setSelectedProduct={setSelectedProduct}
                        loadProductsByCategory={loadProductsByCategory}
                        inputDataText={inputDataText}
                        setInputDataText={setInputDataText}
                        bonusPercent={bonusPercent}
                        setBonusPercent={setBonusPercent}
                        creatingOrder={creatingOrder}
                        createOrderForUser={createOrderForUser}
                        calculateProductPricing={calculateProductPricing}
                        // Exchange
                        
                        balanceMap= {balanceMap}
                        exchangeOpen={exchangeOpen}
                        setExchangeOpen={setExchangeOpen}
                        currencyExchangeFrom={currencyExchangeFrom}
                        setCurrencyExchangeFrom={setCurrencyExchangeFrom}
                        currencyExchangeTo={currencyExchangeTo}
                        setCurrencyExchangeTo={setCurrencyExchangeTo}
                        networkExchangeFrom={networkExchangeFrom}
                        setNetworkExchangeFrom={setNetworkExchangeFrom}
                        networkExchangeTo={networkExchangeTo}
                        setNetworkExchangeTo={setNetworkExchangeTo}
                        exchangeAmount={exchangeAmount}
                        setExchangeAmount={setExchangeAmount}
                        exchangePreview={exchangePreview}
                        loadingPreview={loadingPreview}
                        executingExchange={executingExchange}
                        exchangePairs={exchangePairs}
                        customRate={customRate}
                        setCustomRate={setCustomRate}
                        selectedPairData={selectedPairData}
                        setSelectedPairData={setSelectedPairData}
                        liveRate={liveRate}
                        loadingRate={loadingRate}
                        previewExchange={previewExchange}
                        executeExchange={executeExchange}
                        fetchLiveRate={fetchLiveRate}
                        exchangeOrders={exchangeOrders}
                        loadingExchangeOrders={loadingExchangeOrders}
                        onRefresh={onRefresh}
                        loadExchangeOrders={loadExchangeOrders}
                        transferOpen= {transferOpen}
                        createOrderOpen={createOrderOpen}
                        loadingOrders={loadingOrders}
                        exchangeFromNetworks ={exchangeFromNetworks}
                        exchangeToNetworks={exchangeToNetworks}
                        maxExchangeable={maxExchangeable}
                        setExchangePreview ={setExchangePreview}
                        setLiveRate= {setLiveRate}
                        toNetworkRequired={ toNetworkRequired}
                        fromNetworkRequired={fromNetworkRequired}
                        setCreateOrderOpen={setCreateOrderOpen}
                        formatRate={formatRate}
                      />
                    )}
       

          {/* =====================================================
              TRANSACTIONS
          ===================================================== */}
          {tab === "transactions" && (
                      <TransactionsTab transactions={transactions} loadingTx={loadingTx} />
                    )}

          {/* =====================================================
              CHAT
          ===================================================== */}
          {tab === "messages" && (
            <div className="user-sidebar-chat-wrapper">
              <ChatWindow
                activeChat={activeChat}
                token={token}
                refreshConversations={() => {}}
                mode = "sidebar"
              />
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}