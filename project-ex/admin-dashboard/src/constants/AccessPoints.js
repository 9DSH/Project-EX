// src/constants/AccessPoints.js

const ACCESS_OPTIONS = [
  // ───────────────── BASIC / USERS
  { key: "dashboard.view", label: "View Dashboard", group: "basic" },
  { key: "all.users.view", label: "View All Users", group: "basic" },
  { key: "users.manage", label: "Create/Edit Users", group: "basic" },
  { key: "telegram.global.bot", label: "Global Bot Visibility", group: "basic" },
  { key: "telegram.personal.bot", label: "Personal Bot", group: "basic" },
  { key: "admins.view", label: "View Admins", group: "basic" },
  { key: "admins.promotion", label: "Admin Access Control", group: "basic" },

    // ───────────────── MESSAGE
  { key: "send.message", label: "Send Message", group: "basic" },
   { key: "broadcast.message", label: "Broadcast Message", group: "basic" },



  // ───────────────── FINANCE
  { key: "platform.assets", label: "Assets Management", group: "finance" },
  { key: "balance.manage", label: "Balance Management", group: "finance" },
  { key: "transactions.view", label: "View Transactions", group: "finance" },
   { key: "users.internal.transfer", label: "Internal Transfers", group: "finance" },
    // ───────────────── PAYMENT
  { key: "crypto.payment", label: "Crypto Payment", group: "finance" },
  { key: "irt.payment", label: "IRT Payment", group: "finance" },

  // ───────────────── EXCHANGE
  
  { key: "exchange.service", label: "Manage Exchanges", group: "exchange" },
  { key: "exchange.view", label: "View Exchange History", group: "exchange" },
  { key: "exchange.create", label: "Exchange for Users", group: "exchange" },  
  { key: "platfrom.exchange.service", label: "View Platfrom Exchanges", group: "exchange" },


  // ───────────────── WIRE TRANSFER
  
  { key: "transfer.service", label: "Manage Wire Transfers", group: "transfer" },
  { key: "platform.transfer.service" , label: "View Platform Transfers", group: "transfer" },

  // ───────────────── PRODUCTS
  
  { key: "products.service", label: "Manage Products", group: "products" },
  { key: "platform.products.service", label: "View Platfrom Products", group: "products" },
  { key: "products.view", label: "View Products", group: "products" },
  { key: "products.edit", label: "Edit Products", group: "products" },

    // ───────────────── ORDERS / OPERATIONS
  { key: "orders.manage", label: "Manage Orders", group: "products" },
  { key: "orders.create", label: "Create Orders", group: "products" },
  { key: "orders.view", label: "View Product Orders", group: "products" },



  

  
  

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