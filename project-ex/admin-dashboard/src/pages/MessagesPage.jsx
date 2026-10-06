import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import ConversationList from "../components/ConversationList";
import ChatWindow from "../components/ChatWindow";
import API from "../api/client";
import HeroHub from "../components/HeroHub";
import {
    getConversations,
    getUsers,
    startConversation
} from "../api/messages";
import {
  MessagesSquare,
  MessageCircle ,
  Bell,
  Users,
  Radio,
  Megaphone,
  Speaker,
  ArrowLeft
} from "lucide-react";
import useMessagesSocket from "../hooks/useMessagesSocket";
import { hasPermission } from "../utils/permissions";
import "./Messages.css";

// ── Skeleton ──────────────────────────────────────────────────
function Sk({ w = "100%", h = 16, r = 6 }) {
    return (
        <div
            className="msg-sk"
            style={{ width: w, height: h, borderRadius: r }}
        />
    );
}

// ── Stat Pill ─────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, accent, loading }) {
  return (
    <div className="msg-statpill">
      <div
        className="msg-statpill-icon"
        style={{ background: accent + "18", color: accent }}
      >
        <Icon size={17} />
      </div>
      <div>
        <div className="msg-statpill-label">
          {label}
        </div>
        {loading ? (
          <Sk w={56} h={22} />
        ) : (
          <div className="msg-statpill-value" style={{ color: accent }}>
            {value ?? "—"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ name, size = 38, online }) {
    const colors = ["#3b82f6","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899"];
    const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
    return (
        <div className="msg-avatar-wrap">
            <div
                className="msg-avatar"
                style={{
                    width: size, height: size,
                    background: color + "22", border: `1.5px solid ${color}44`,
                    fontSize: size * 0.38, color,
                }}
            >
                {name?.[0]?.toUpperCase() || "?"}
            </div>
            {online !== undefined && (
                <div
                    className="msg-avatar-status"
                    style={{ background: online ? "#22c55e" : "#475569" }}
                />
            )}
        </div>
    );
}

// ── Broadcast Modal ───────────────────────────────────────────

function BroadcastPanel({ users, onSend, canBroadcast }) {
    const [message, setMessage] = useState("");
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [userSearch, setUserSearch] = useState("");
    const activeUsers = users.filter(u => u.is_active !== false && u.telegram_id !== null);

    const filteredUsers = activeUsers.filter(u =>
        u.username?.toLowerCase().includes(userSearch.toLowerCase())
    );

    const toggleUser = (user) => {
        setSelectedUsers(prev => {
            const exists = prev.find(u => u.user_id === user.user_id);
            if (exists) return prev.filter(u => u.user_id !== user.user_id);
            return [...prev, user];
        });
    };

    const handleSend = async () => {
        if (!message.trim() || selectedUsers.length === 0) return;
        await onSend(message, selectedUsers);
        setMessage("");
        setSelectedUsers([]);
    };

    const toggleSelectAll = () => {
        const allFilteredIds = filteredUsers.map(u => u.user_id);

        const isAllSelected = allFilteredIds.every(id =>
            selectedUsers.some(u => u.user_id === id)
        );

        if (isAllSelected) {
            // remove all filtered users
            setSelectedUsers(prev =>
                prev.filter(u => !allFilteredIds.includes(u.user_id))
            );
        } else {
            // add missing filtered users
            const toAdd = filteredUsers.filter(
                u => !selectedUsers.some(s => s.user_id === u.user_id)
            );
            setSelectedUsers(prev => [...prev, ...toAdd]);
            }
        };

    if (!canBroadcast) {
        return (
            <div className="bc-empty">
                No broadcast permission
            </div>
        );
    }

    return (
        <div className="bc-panel">

            {/* HEADER */}
            <div className="bc-header">

                <div className="bc-title">
                    <Megaphone size={15} /> Broadcast
                    {activeUsers.length > 0 &&(
                        <span className="count">{activeUsers.length}</span>
                    )}
                </div>

                <div className="bc-header-right">
                    <div className="bc-selected-count">
                        {selectedUsers.length} selected
                    </div>
                    <button
                        onClick={toggleSelectAll}
                        className="bc-select-all-btn"
                    >
                        Select All Active
                    </button>
                </div>
            </div>

            {/* SEARCH */}
            <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search users..."
                className="bc-search"
            />

            {/* USER LIST */}
            <div className="bc-userlist">
                {filteredUsers.map(user => {
                    const selected = selectedUsers.some(u => u.user_id === user.user_id);

                    return (
                        <div
                            key={user.user_id}
                            onClick={() => toggleUser(user)}
                            className={`bc-user-row${selected ? " selected" : ""}`}
                        >
                            <input type="checkbox" checked={selected} readOnly />
                            <Avatar name={user.username} size={26} online={user.is_online} />
                            <div className="bc-user-name">
                                {user.username}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* MESSAGE */}
            <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Write broadcast message..."
                className="bc-message"
            />

            {/* SEND */}
            <button
                onClick={handleSend}
                disabled={!message.trim() || selectedUsers.length === 0}
                className="bc-send-btn"
            >
                Send Broadcast ({selectedUsers.length})
            </button>
        </div>
    );
}

// ── New Chat Dropdown ─────────────────────────────────────────
function NewChatDropdown({ users, search, setSearch, onStart, onClose, dropdownRef }) {
    const filtered = users.filter(u =>
        u.username?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={dropdownRef} className="msg-dropdown">
            {/* Search */}
            <div className="msg-dropdown-search">
                <div className="msg-dropdown-search-wrap">
                    <span className="msg-dropdown-search-icon">🔍</span>
                    <input
                        autoFocus
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search users…"
                    />
                </div>
            </div>

            {/* User list */}
            <div className="msg-dropdown-list">
                {filtered.length === 0 ? (
                    <div className="msg-dropdown-empty">No users found</div>
                ) : (
                    filtered.map(u => (
                        <div
                            key={u.user_id}
                            onClick={() => onStart(u)}
                            className="msg-dropdown-item"
                        >
                            <Avatar name={u.username} size={32} online={u.is_online} />
                            <div>
                                <div className="msg-dropdown-item-name">{u.username}</div>
                                {u.email && <div className="msg-dropdown-item-email">{u.email}</div>}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────
export default function MessagesPage() {
    const [conversations, setConversations] = useState([]);
    // Internal admin<->master thread(s) — master: one row per admin;
    // regular admin: a single synthetic row for their own thread with master.
    const [internalItems, setInternalItems] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");
    const [showNewChat, setShowNewChat] = useState(false);
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [convSearch, setConvSearch] = useState("");
    // Mobile: which single panel is visible ("list" | "chat")
    const [mobileView, setMobileView] = useState("list");
    // Tablet/mobile: broadcast slide-over open state
    const [showBroadcast, setShowBroadcast] = useState(false);
    const dropdownRef = useRef(null);
    const newChatBtnRef = useRef(null);
    const token = localStorage.getItem("token");

    const rawAccessPoints = localStorage.getItem("access_points");
    const currentAdminId = Number(localStorage.getItem("user_id")) || null;
    const role = localStorage.getItem("role");
    const isMaster = role === "master";

    let accessPoints = rawAccessPoints;

    try {
            accessPoints = JSON.parse(rawAccessPoints);
            } catch (e) {
            accessPoints = rawAccessPoints;
            }
    const canViewAllUsers = hasPermission(accessPoints, "all.users.view");
    const canBroadcast =  hasPermission(accessPoints, "broadcast.message");

    // ── Load internal admin<->master thread(s) ──
    const loadInternal = useCallback(async () => {
        if (!token) return;
        try {
            if (isMaster) {
                const res = await API.get("/admin-master-messages/inbox", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const rows = (res.data || []).map(row => ({
                    conversation_id: row.conversation_id,
                    user_id: row.admin_id,
                    username: row.username || `Admin #${row.admin_id}`,
                    kind: "internal",
                    last_message: row.last_message,
                    last_time: row.last_time,
                    unread_count: row.unread_count || 0,
                }));
                setInternalItems(rows);
            } else {
                const res = await API.get("/admin-master-messages/summary", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setInternalItems([{
                    conversation_id: res.data.conversation_id,
                    user_id: "master",
                    username: "Master",
                    kind: "internal",
                    last_message: res.data.last_message,
                    last_time: res.data.last_time,
                    unread_count: res.data.unread_count || 0,
                }]);
            }
        } catch (err) {
            console.log(err);
        }
    }, [token, isMaster]);

    // ── Derived merged list (support + internal) ──
    const allConversations = useMemo(() => {
        const merged = [...conversations, ...internalItems];
        return merged.sort(
            (a, b) => new Date(b.last_time || 0) - new Date(a.last_time || 0)
        );
    }, [conversations, internalItems]);

    // ── Derived stats ──
    const totalUnread = allConversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
    const activeConvs = allConversations.filter(c => c.last_time).length;

    // ── Load conversations ──
    const loadConversations = useCallback(async () => {
        try {
            const res = await getConversations(token);
            const sorted = (res || []).sort(
                (a, b) => new Date(b.last_time || 0) - new Date(a.last_time || 0)
            );
            setConversations(sorted);
        } catch (err) {
            console.log(err);
        } finally {
            setLoadingConvs(false);
        }
    }, [token]);

    // ── Combined refresh (used after sending a message, on socket events) ──
    const refreshAll = useCallback(async () => {
        await Promise.all([loadConversations(), loadInternal()]);
    }, [loadConversations, loadInternal]);

    // ── Load users ──
    const loadUsers = async () => {
        try {
            const res = await getUsers(token);
            const fetchedUsers = res || [];
            const visibleUsers = canViewAllUsers
                ? fetchedUsers
                : fetchedUsers.filter(
                    u => Number(u.admin_id) === currentAdminId
                    );

                setUsers(visibleUsers);

      
        } catch (err) {
            console.log(err);
        }
    };

    useEffect(() => {
        if (!token) return;
        loadConversations();
        loadInternal();
        loadUsers();
    }, [token, loadConversations, loadInternal]);

    // ── Light periodic refresh for the internal badge count / list ──
    useEffect(() => {
        if (!token) return;
        const interval = setInterval(loadInternal, 5000);
        return () => clearInterval(interval);
    }, [token, loadInternal]);

    // ── Outside click handler ──
    useEffect(() => {
        const handleClick = (e) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target) &&
                newChatBtnRef.current &&
                !newChatBtnRef.current.contains(e.target)
            ) {
                setShowNewChat(false);
                setSearch("");
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    // ── Socket ──
    useMessagesSocket((data) => {
        if (data.type !== "new_message") return;
        const convId = data.conversation_id;

        setConversations(prev => {
            const updated = prev.map(c => {
                if (c.conversation_id !== convId) return c;
                return {
                    ...c,
                    last_message: data.message.content || "📎 Media",
                    last_time: new Date().toISOString(),
                    unread_count: data.message.sender === "user" ? c.unread_count + 1 : c.unread_count,
                };
            });
            return updated.sort(
                (a, b) => new Date(b.last_time || 0) - new Date(a.last_time || 0)
            );
        });

        if (activeChat?.conversation_id === convId) {
            window.dispatchEvent(new CustomEvent("reload_messages", { detail: convId }));
        }
    });

    // ── Start chat ──
    const handleStartChat = async (user) => {
        try {
            const res = await startConversation(user.user_id, token);
            setActiveChat({
                conversation_id: res.conversation_id,
                user_id: user.user_id,
                username: user.username,
                kind: "support",
                last_message: "",
                unread_count: 0,
            });
            setShowNewChat(false);
            setSearch("");
            setMobileView("chat");
            await loadConversations();
        } catch (err) {
            console.log(err);
        }
    };

    // ── Broadcast ──
    const handleBroadcast = async (message, targetUsers) => {
        if (!canBroadcast) return;

        try {
            for (const user of targetUsers) {

                // 1. get or create conversation
                const conv = await startConversation(user.user_id, token);

                // 2. send message using SAME endpoint as ChatWindow
                await API.post(
                    "/admin/messages/send",
                    {
                        conversation_id: conv.conversation_id,
                        content: message,
                        media_type: null,
                        media_file: null
                    },
                    {
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );
            }

            await loadConversations();

        } catch (err) {
            console.log(err);
        }
    };

    const activeUsers = users.filter(u => u.is_active !== false);
        // ── Conversation search: filters existing conversations by username,
    // and also surfaces any matching user who doesn't have a conversation
    // yet, so typing a username always finds them (clicking starts a chat).
    const normalizedConvSearch = convSearch.trim().toLowerCase();

    const filteredConversations = normalizedConvSearch
        ? allConversations.filter(c => c.username?.toLowerCase().includes(normalizedConvSearch))
        : allConversations;

    const conversationUserIds = new Set(allConversations.map(c => c.user_id));
    const matchingNewUsers = normalizedConvSearch
        ? users.filter(u =>
            u.user_id !== undefined &&
            !conversationUserIds.has(u.user_id) &&
            u.username?.toLowerCase().includes(normalizedConvSearch)
          )
        : [];

    const displayedConversations = normalizedConvSearch
        ? [
            ...filteredConversations,
            ...matchingNewUsers.map(u => ({
                conversation_id: `new-${u.user_id}`,
                user_id: u.user_id,
                username: u.username,
                kind: "support",
                last_message: "Start a new conversation",
                last_time: null,
                unread_count: 0,
                isNew: true,
            })),
          ]
        : allConversations;

    const handleSelectConversation = (conv) => {
        if (conv.isNew) {
            handleStartChat({ user_id: conv.user_id, username: conv.username });
            setConvSearch("");
            return;
        }
        setActiveChat(conv);
        setMobileView("chat");
        // Mark as read (local optimistic update)
        if (conv.kind === "internal") {
            setInternalItems(prev =>
                prev.map(c =>
                    c.conversation_id === conv.conversation_id
                        ? { ...c, unread_count: 0 }
                        : c
                )
            );
        } else {
            setConversations(prev =>
                prev.map(c =>
                    c.conversation_id === conv.conversation_id
                        ? { ...c, unread_count: 0 }
                        : c
                )
            );
        }
    };

    return (

            <div className="msg-page">
          {/* ── HERO HUB — ONE fixed filter set, shared and applied across Products / Orders / Analysis ── */}
            <div className="msg-hero-wrap">
                <HeroHub
                title="Messages"
                subtitle="Direct conversations &amp; broadcasts"
                search={{
                    value: convSearch,
                    onChange: setConvSearch,
                    placeholder: "Search users…",
                    label: "Search",
                }}
                statPills={[
                    { key: "users", icon: Users, label: "Active Users", value: activeUsers.length, accent: "#3b82f6", loadingConvs },
                    { key: "orders", icon: MessagesSquare, label: "Conversations", value: allConversations.length, accent: "#a78bfa", loading: loadingConvs },
                    { key: "value", icon: Bell, label: "Unread", value: totalUnread, accent: "#eb0f0b", loading: loadingConvs },
                ]}
                />
            </div>

            {/* CENTER AREA */}
            <div className="msg-center">
            {/* CHAT CONTAINER */}
            <div className="msg-container">

            {/* ═══ BODY ═══════════════════════════════════════════ */}
            <div className="msg-body" data-view={mobileView}>

                {/* LEFT: Conversation list */}
                <div className="msg-col-list">
                    {/* Search bar inside sidebar */}
                    <div className="msg-sidebar-header">
                    {/* Bottom row: action buttons */}
                        <div className="msg-sidebar-actions">
                            {/* New Chat button with dropdown */}
                            <div style={{ position: "relative" }}>
                                <button
                                    ref={newChatBtnRef}
                                    onClick={() => { setShowNewChat(v => !v); setSearch(""); }}
                                    className={`msg-newchat-btn${showNewChat ? " active" : ""}`}
                                >
                                    <span style={{ fontSize: 15, display: "flex" }}><MessageCircle size={20}/></span>
                                    New Chat
                                    <span className={`msg-newchat-caret${showNewChat ? " open" : ""}`}>▾</span>
                                </button>

                                {showNewChat && (
                                    <NewChatDropdown
                                        users={users}
                                        search={search}
                                        setSearch={setSearch}
                                        onStart={handleStartChat}
                                        onClose={() => { setShowNewChat(false); setSearch(""); }}
                                        dropdownRef={dropdownRef}
                                    />
                                )}
                            </div>


                            {/* Unread badge shortcut */}
                            {totalUnread > 0 && (
                                <div className="msg-unread-shortcut">
                                    <span className="badge">{totalUnread}</span>
                                    unread
                                </div>
                            )}

                            {/* Broadcast toggle — visible on tablet/mobile only (see CSS).
                                On mobile it switches the single visible panel; on tablet
                                it opens the slide-over. */}
                            <button
                                type="button"
                                className="msg-broadcast-toggle"
                                onClick={() => {
                                    setMobileView("broadcast");
                                    setShowBroadcast(true);
                                }}
                            >
                                <Megaphone size={15} />
                                Broadcast
                            </button>

                        </div>
                        
                    </div>

                    {/* Conversation list */}
                    <div className="msg-list-scroll">
                            {loadingConvs ? (
                                <div className="msg-list-skeleton">
                                    {[1,2,3,4,5].map(i => (
                                        <div key={i} className="msg-list-skeleton-row">
                                            <Sk w={40} h={40} r={20} />
                                            <div className="msg-list-skeleton-body">
                                                <Sk w="60%" h={13} r={6} />
                                                <div className="msg-list-skeleton-gap"><Sk w="90%" h={11} r={5} /></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : displayedConversations.length === 0 ? (
                                 <div className="msg-list-empty">
                                     <div className="msg-list-empty-icon"><MessagesSquare/></div>
                                   <div className="msg-list-empty-title">
                                        {normalizedConvSearch ? "No matching conversations or users" : "No conversations yet"}
                                    </div>
                                   <div className="msg-list-empty-sub">
                                        {normalizedConvSearch ? "Try a different search" : "Start a new chat to begin"}
                                    </div>
                                 </div>
                             ) : (
                                 <ConversationList
                                     conversations={displayedConversations}
                                     activeChat={activeChat}
                                     setActiveChat={handleSelectConversation}
                                 />
                             )}
                        </div>
                    </div>

                {/* center: Chat window */}
                <div className="msg-col-chat">
                    {activeChat ? (
                        <ChatWindow
                            activeChat={activeChat}
                            token={token}
                            refreshConversations={refreshAll}
                            mode="message"
                            onBack={() => setMobileView("list")}
                        />
                    ) : (
                        /* Empty state */
                        <div className="chat-emptystate">
                            <div className="chat-emptystate-icon"><MessagesSquare/></div>
                            <div className="chat-emptystate-title">Select a conversation</div>
                            <div className="chat-emptystate-sub">
                                Choose a conversation from the left, or start a new chat with any user.
                            </div>
                            <button
                                onClick={() => setShowNewChat(true)}
                                className="chat-emptystate-btn"
                            >
                                ✏️ Start new chat
                            </button>
                        </div>
                    )}
                </div>

                {/* Backdrop for broadcast slide-over (tablet only; hidden on mobile) */}
                <div
                    className={`msg-broadcast-backdrop${showBroadcast ? " open" : ""}`}
                    onClick={() => setShowBroadcast(false)}
                />

                   {/* RIGHT: Broadcast window.
                       Tablet: slide-over (open/close via the toggle + backdrop).
                       Mobile: a normal full-width panel, shown via data-view. */}
                <div className={`msg-col-broadcast${showBroadcast ? " open" : ""}`}>

                  {/* Mobile-only header with a back button (hidden on desktop/tablet via CSS) */}
                  <div className="msg-broadcast-header-mobile">
                      <button
                          type="button"
                          className="msg-mobile-back"
                          onClick={() => { setMobileView("list"); setShowBroadcast(false); }}
                          aria-label="Back to conversations"
                      >
                          <ArrowLeft size={18} />
                      </button>
                      <div className="msg-broadcast-header-mobile-title">
                          <Megaphone size={15} /> Broadcast
                      </div>
                  </div>

                  <BroadcastPanel
                    users={users}
                    onSend={handleBroadcast}
                    canBroadcast={canBroadcast}
                />

                 </div>

            </div>

         

        </div>
         </div>
          </div>
    );
}

// ── Modal Styles ──────────────────────────────────────────────
const MS = {
    overlay: {
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 999, backdropFilter: "blur(6px)",
    },
    card: {
        width: "92%", maxWidth: 500, background: "#08111f",
        border: "1px solid #0f2040", borderRadius: 20,
        padding: 26, boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
    },
    closeBtn: {
        background: "#0b1728", border: "1px solid #1a2d4a",
        color: "#475569", width: 32, height: 32, borderRadius: 8,
        cursor: "pointer", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 13, flexShrink: 0,
    },
    cancelBtn: {
        background: "transparent", border: "1px solid #1a2d4a",
        color: "#475569", borderRadius: 10, padding: "10px 18px",
        cursor: "pointer", fontWeight: 600, fontSize: 13, flexShrink: 0,
    },
    sendBtn: {
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        gap: 7, border: "1px solid", borderRadius: 10, padding: "10px 18px",
        cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.2s",
    },
};