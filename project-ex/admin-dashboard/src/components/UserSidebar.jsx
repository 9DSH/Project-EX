import { useEffect, useState, useCallback, useRef,  useMemo } from "react";
import { API_URL } from "../config";
import ACCESS_OPTIONS, { ACCESS_GROUPS } from "../constants/AccessPoints";
import ChatWindow from "../components/ChatWindow";
import ProfileTab from "./sidebar/ProfileTab";
import WalletTab from "./sidebar/WalletTab";
import OrdersTab from "./sidebar/OrdersTab";
import TransactionsTab from "./sidebar/TransactionsTab";
import { hasPermission } from "../utils/permissions";
import PermissionGate from "../components/PermissionGate";


const TABS = [
  { key: "profile", label: "👤 Profile" },

  { key: "wallet", label: "💰 Wallet" },

  { key: "orders", label: "📦 Orders"},

  { key: "transactions", label: "🧾 Transactions" },

  { key: "messages", label: "💬 Messages" },
];

function calculateProductPricing(product,  targetUser, bonusPercent = 0) {
  const originalPrice = Number(product.price || 0);

  let current = originalPrice;

  const steps = [];

  // Product Discount
  if (product.discount_percent) {
    const percent = Number(product.discount_percent);
    const deducted = current * (percent / 100);

    current -= deducted;

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
    totalSaved,
    effectiveDiscount,
    steps,
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
  const [adminUsername, setAdminUsername] = useState("");
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
    canManageExchange: hasPermission(currentUser, "exchange.manage"),
    canEditUser: hasPermission(currentUser, "users.edit"),
  }), [currentUser]);

 
  // Get USERNAME by ID
  async function getUsernameById(userId) {
    if (!userId) return "";
    const res = await fetch(`${API_URL}/admin/users/username/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.username || "";
  }

  // usage of UsernameByID
  useEffect(() => {
    if (user?.admin_id) getUsernameById(user.admin_id).then(setAdminUsername);
    else setAdminUsername("");
  }, [user?.admin_id]);

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
        `${API_URL}/products/by-category/${categoryId}`
      );

      const data = await res.json();

      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed loading products", err);
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
      console.log(data)
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

      console.log(data)

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
   

  return (
    <>
      {/* OVERLAY */}
      <div onClick={handleClose} style={styles.overlay(visible)} />

      {/* SIDEBAR */}
      <div style={styles.container(visible)} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div style={styles.header}>
          <div>
            <div style={styles.userTitle}>{user.username}</div>
              <div style={styles.userSub}>
              USER #{user.user_id} - Created by #{user.admin_id} {adminUsername ?? "—"} -  {" "}
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

          <button onClick={handleClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* TABS */}
        <div style={styles.tabs}>
          {TABS.map(tabItem => (
            <button
              key={tabItem.key}
              style={tab === tabItem.key ? styles.activeTab : styles.tab}
              onClick={() => setTab(tabItem.key)}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div style={styles.content}>

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
            <div style={styles.chatWrapper}>
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
    </>
  );
}

// =====================================================
// STYLES
// =====================================================

const customScrollbar = {
  scrollbarWidth: "thin",
  scrollbarColor: "#64748b #1e293b",
  overflowY: "auto",
  overflowX: "auto",
};

const styles = {
  overlay: (visible) => ({
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    backdropFilter: "blur(4px)",
    zIndex: 50,
    opacity: visible ? 1 : 0,
    transition: "opacity 250ms ease",
  }),

  container: (visible) => ({
    position: "fixed",
    top: 0,
    right: 0,
    width: 580,
    height: "100vh",
    background: "#0f172a",
    borderLeft: "2px solid #1e293b",
    color: "white",
    zIndex: 60,
    display: "flex",
    flexDirection: "column",

    transform: visible ? "translateX(0%)" : "translateX(100%)",
    opacity: visible ? 1 : 0,
    transition: "transform 200ms ease, opacity 250ms ease",
  }),

  header: {
    padding: 20,
    borderBottom: "1px solid #1e293b",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  userTitle: { fontSize: 20, fontWeight: 700 },
  userSub: { fontSize: 12, color: "#94a3b8", marginTop: 4 },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#111827",
    color: "white",
    cursor: "pointer",
  },

  tabs: {
    display: "flex",
    gap: 8,
    padding: 14,
    overflowX: "auto",
    borderBottom: "1px solid #1e293b",
    scrollbarWidth: "thin",
    scrollbarColor: "#64748b #1e293b",
  },

  tab: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #1e293b",
    background: "#111827",
    color: "#94a3b8",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  activeTab: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #2563eb",
    background: "#1d4fd871",
    color: "white",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 600,
  },

  content: {
    flex: 1,
    padding: 18,
    ...customScrollbar,
  },

  section: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #1e293b",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },

  sectionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 18 },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },

  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 13,
    color: "#94a3b8",
  },

  input: {
    width: "100%",
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: 12,
    color: "white",
    outline: "none",
    boxSizing: "border-box",
  },

  primaryBtn: {
    width: "100%",
    background: "#1d4fd871",
    border: "none",
    marginTop: 20,
    borderRadius: 14,
    padding: 14,
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },

  toggleRow: {
    marginTop: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  enabledToggle: {
    background: "rgba(34,197,94,0.15)",
    color: "#22c55e",
    border: "1px solid rgba(34,197,94,0.3)",
    borderRadius: 999,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },

  disabledToggle: {
    background: "rgba(239,68,68,0.15)",
    color: "#ef4444",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 999,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },

  list: { display: "flex", flexDirection: "column", gap: 12, ...customScrollbar },
  card: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: { fontWeight: 700, marginBottom: 6 },
  cardSub: { color: "#94a3b8", fontSize: 13 },

  chatWrapper: { 
    height: "100%", 
    display: "flex", 
    flexDirection: "column",
    overflow: "hidden",
 },

  balanceGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 15 },

  balanceCard: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #1e293b",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  balanceHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  balanceCurrency: { fontSize: 18, fontWeight: 700, color: "white" },
  balanceNetwork: {
    fontSize: 11,
    fontWeight: 600,
    color: "#93c5fd",
    background: "rgba(37,99,235,0.15)",
    border: "1px solid rgba(37,99,235,0.25)",
    padding: "4px 8px",
    borderRadius: 999,
  },

  balanceRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  balanceLabel: { fontSize: 12, color: "#94a3b8" },
  availableValue: { color: "#22c55e", fontWeight: 700, fontSize: 15 },
  frozenValue: { color: "#f59e0b", fontWeight: 700, fontSize: 15 },

  emptyBalances: {
    gridColumn: "1 / -1",
    textAlign: "center",
    padding: 24,
    borderRadius: 16,
    border: "1px dashed #334155",
    background: "#0b1220",
    color: "#64748b",
  },

  // ── INTERNAL TRANSFER ──────────────────────────────────────────
  transferBox: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #2564eb63",
    borderRadius: 15,
    overflow: "visible",
    marginTop: 4,
    marginBottom:10
  },

  transferHeader: {
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    borderBottom: "1px solid #1e293b",
    userSelect: "none",
  },

  transferIcon: {
    fontSize: 16,
    color: "#60a5fa",
    background: "rgba(37,99,235,0.15)",
    border: "1px solid rgba(37,99,235,0.25)",
    borderRadius: 8,
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    flexShrink: 0,
  },

  transferHeaderLabel: { fontWeight: 600, color: "#e2e8f0", fontSize: 14 },
  transferHeaderSub: { fontSize: 11, color: "#64748b", marginTop: 2 },

  transferBody: {
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  transferSelectedBadge: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#22c55e",
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    pointerEvents: "none",
  },

  transferSpinner: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#64748b",
    fontSize: 16,
    pointerEvents: "none",
  },

  transferDropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 12,
    zIndex: 999,
    maxHeight: 200,
    overflowY: "auto",
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
  },

  transferDropItem: {
    padding: "10px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    borderBottom: "1px solid #1e293b",
  },

  transferBalanceHint: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 10,
    padding: "8px 12px",
  },

  transferMaxBtn: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(37,99,235,0.2)",
    border: "1px solid rgba(37,99,235,0.4)",
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: 800,
    padding: "4px 8px",
    borderRadius: 6,
    cursor: "pointer",
    letterSpacing: 0.5,
  },

  transferPreview: {
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 14,
    padding: "10px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },

  transferPreviewRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    borderBottom: "1px solid #1e293b",
  },

  transferErrorBox: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#ef4444",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
  },

  transferSuccessBox: {
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#22c55e",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
  },

  transferBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)",
    border: "1px solid rgba(37,99,235,0.4)",
    borderRadius: 14,
    padding: "13px 0",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  // ── END INTERNAL TRANSFER ──────────────────────────────────────

  ordersList: { display: "flex", flexDirection: "column", gap: 14, ...customScrollbar },

  orderCard: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #2c384dff",
    borderRadius: 20,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  orderTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  orderProduct: { fontSize: 16, fontWeight: 700, color: "white" },
  orderMeta: { marginTop: 6, fontSize: 12, color: "#64748b" },

  orderStatus: { padding: "7px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, border: "1px solid" },
  statusPending: { background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.25)", color: "#f59e0b" },
  statusApproved: { background: "rgba(59,130,246,0.12)", borderColor: "rgba(59,130,246,0.25)", color: "#60a5fa" },
  statusDelivered: { background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.25)", color: "#22c55e" },
  statusDefault: { background: "rgba(246, 7, 7, 0.35)", borderColor: "rgba(184, 156, 148, 0.25)", color: "#b89994ff" },

  orderPriceRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  orderPrice: { fontSize: 22, fontWeight: 800, color: "white" },
  orderCurrency: { fontSize: 13, marginLeft: 8, color: "#94a3b8", fontWeight: 600 },

  networkBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(37,99,235,0.25)",
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: 700,
  },

  orderDates: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

  dateItem: { background: "#0b1220", border: "1px solid #1e293b", borderRadius: 14, padding: 12 },
  dateLabel: { display: "block", fontSize: 11, color: "#64748b", marginBottom: 6 },
  dateValue: { fontSize: 13, color: "#e2e8f0", fontWeight: 600 },

  emptyOrders: {
    padding: 24,
    borderRadius: 18,
    textAlign: "center",
    border: "1px dashed #334155",
    background: "#111827",
    color: "#64748b",
  },

  transactionsList: { display: "flex", flexDirection: "column", gap: 14, ...customScrollbar },

  txCard: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #2c384dff",
    borderRadius: 20,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  txHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  txType: { fontSize: 16, fontWeight: 700, color: "white", textTransform: "capitalize" },
  txMeta: { marginTop: 6, fontSize: 12, color: "#64748b" },

  txStatus: { padding: "7px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, border: "1px solid" },
  txCompleted: { background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.25)", color: "#22c55e" },
  txPending: { background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.25)", color: "#f59e0b" },
  txFailed: { background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.25)", color: "#ef4444" },

  txAmountRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  txAmount: { fontSize: 24, fontWeight: 800 },

  chainBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(37,99,235,0.25)",
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: 700,
  },

  txBlockchain: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: 14,
  },

  txInfoItem: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  txInfoLabel: { fontSize: 12, color: "#64748b" },
  txInfoValue: { fontSize: 12, color: "#e2e8f0", fontWeight: 600, fontFamily: "monospace" },

  txFooter: { display: "flex", justifyContent: "flex-end" },
  txDate: { fontSize: 12, color: "#64748b" },

  emptyTransactions: {
    padding: 24,
    borderRadius: 18,
    textAlign: "center",
    border: "1px dashed #334155",
    background: "#111827",
    color: "#64748b",
  },

  subTabs: { display: "flex", gap: 10, marginBottom: 14 },

  subTab: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid #1e293b",
    background: "#0b1220",
    color: "#94a3b8",
    cursor: "pointer",
  },

  subTabActive: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid #2563eb",
    background: "#1d4fd871",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  },

  createOrderBox: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #2564eb63",
    borderRadius: 15,
    overflow: "hidden",
  },


  createOrderBody: {
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  ordersDivider: { display: "flex", alignItems: "center", gap: 12, marginTop: 18, marginBottom: 18 },
  ordersDividerLine: { flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #334155, transparent)" },
  ordersDividerText: { fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "#64748b", whiteSpace: "nowrap" },
};