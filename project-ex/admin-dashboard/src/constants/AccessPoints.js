// src/constants/AccessPoints.js

const ACCESS_OPTIONS = [
  // ───────────────── BASIC / USERS
  { key: "dashboard.view", label: "View Dashboard", group: "basic" },
  { key: "users.view", label: "View All Users", group: "basic" },
  { key: "users.create", label: "Create Users", group: "basic" },
  { key: "users.edit", label: "Edit Users", group: "basic" },
  { key: "telegram_global_bot_access", label: "Global Bot Visibility", group: "basic" },
  { key: "telegram_personal_bot", label: "Personal Bot", group: "basic" },
    // ───────────────── MESSAGE
  { key: "send.message", label: "Send Message", group: "basic" },
   { key: "broadcast.message", label: "Broadcast Message", group: "basic" },
  
  { key: "orders.view", label: "View Product Orders", group: "basic" },
  { key: "admins.view", label: "View Admins", group: "basic" },
  { key: "admins.promotion", label: "Admin Access Control", group: "basic" },

  // ───────────────── ORDERS / OPERATIONS
  { key: "orders.manage", label: "Manage Orders", group: "finance" },
  { key: "orders.create", label: "Create Orders", group: "finance" },
  // ───────────────── FINANCE
  { key: "finance.asset", label: "Assets Management", group: "finance" },
  { key: "finance.manage", label: "Finance Management", group: "finance" },
  { key: "transaction.view", label: "View Transactions", group: "finance" },
   { key: "users.internal_transfer", label: "Internal Transfers", group: "finance" },



  // ───────────────── EXCHANGE
  { key: "exchange.view", label: "View Exchanges", group: "exchange" },
  { key: "exchange.manage", label: "Manage Exchanges", group: "exchange" },
  { key: "platform_exchange_management", label: "Platform Exchange Management (Cross-Admin)", group: "exchange" },


  // ───────────────── WIRE TRANSFER
  { key: "wire_transfer.view",   label: "View Wire Transfers",   group: "transfer" },
  { key: "wire_transfer.manage", label: "Manage Wire Transfers", group: "transfer" },

  // ───────────────── PRODUCTS
  { key: "products.view", label: "View Products", group: "products" },
  { key: "products.create", label: "Create Products", group: "products" },
  { key: "products.edit", label: "Edit Products", group: "products" },
  { key: "products.delete", label: "Delete Products", group: "products" },
  { key: "products.manage", label: "Manage Products", group: "products" },

  
  

];

export default ACCESS_OPTIONS;

/* Optional helper (VERY USEFUL) */
export const ACCESS_GROUPS = {
  basic: ACCESS_OPTIONS.filter((a) => a.group === "basic"),
  finance: ACCESS_OPTIONS.filter((a) => a.group === "finance"),
  products: ACCESS_OPTIONS.filter((a) => a.group === "products"),
  exchange: ACCESS_OPTIONS.filter((a) => a.group === "exchange"),
  transfer: ACCESS_OPTIONS.filter((a) => a.group === "transfer"),
};