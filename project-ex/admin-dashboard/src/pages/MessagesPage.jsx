import { useEffect, useState, useRef, useCallback } from "react";
import ConversationList from "../components/ConversationList";
import ChatWindow from "../components/ChatWindow";
import API from "../api/client";
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
   Speaker
} from "lucide-react";
import useMessagesSocket from "../hooks/useMessagesSocket";
import { hasPermission } from "../utils/permissions";

// ── Skeleton ──────────────────────────────────────────────────
function Sk({ w = "100%", h = 16, r = 6 }) {
    return (
        <div style={{
            width: w, height: h, borderRadius: r,
            background: "linear-gradient(90deg,#151f30 25%,#1e2d44 50%,#151f30 75%)",
            backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite"
        }} />
    );
}

// ── Stat Pill ─────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, accent, loading }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "#071020ff",
        borderRadius: 12,
        padding: "10px 10px",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: accent + "18",
          color: accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={17} />
      </div>
      <div>
        <div
          style={{
            fontSize: 10,
            color: "#475569",
            fontWeight: 700,
            letterSpacing: 0.6,
            marginBottom: 3,
          }}
        >
          {label}
        </div>
        {loading ? (
          <Sk w={56} h={22} />
        ) : (
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: accent,
              letterSpacing: -0.5,
            }}
          >
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
        <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
                width: size, height: size, borderRadius: "50%",
                background: color + "22", border: `1.5px solid ${color}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: size * 0.38, fontWeight: 700, color,
            }}>
                {name?.[0]?.toUpperCase() || "?"}
            </div>
            {online !== undefined && (
                <div style={{
                    position: "absolute", bottom: 0, right: 0,
                    width: 9, height: 9, borderRadius: "50%",
                    background: online ? "#22c55e" : "#475569",
                    border: "2px solid #0b1728",
                }} />
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
            <div style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#475569",
                fontSize: 13
            }}>
                No broadcast permission
            </div>
        );
    }

    return (
        <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: 20,
            background: "#08111f",
            borderRadius: 15,
            overflow: "hidden"
        }}>

            {/* HEADER */}
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 10,
                alignItems: "center"
            }}>

                <div style={{ color: "#a78bfa", fontWeight: 700 , marginLeft:10}}>
                <Megaphone size={15} /> Broadcast
                    {activeUsers.length > 0 &&(
                            <span style={{
                                background: "rgba(139,92,246,0.3)", border: "1px solid rgba(139,92,246,0.4)",
                                color: "#c4b5fd", borderRadius: 99, fontSize: 11,
                                fontWeight: 700, padding: "1px 7px", marginLeft:10
                            }}>{activeUsers.length}</span>
                        )}
                </div>

             <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
 
                <div style={{ fontSize: 11, color: "#6f7987ff" }}>
                    {selectedUsers.length} selected
                </div>
                <button
                    onClick={toggleSelectAll}
                    style={{
                        background: "rgba(59,130,246,0.12)",
                        border: "1px solid rgba(59,130,246,0.3)",
                        color: "#60a5fa",
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 8px",
                        cursor: "pointer"
                    }}
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
                style={{
                    background: "#06101e",
                    border: "1px solid #1a2d4a",
                    color: "white",
                    padding: 8,
                    borderRadius: 10,
                    marginBottom: 8
                }}
            />

            {/* USER LIST */}
            <div style={{
                flex: 1,
                overflowY: "auto",
                border: "1px solid #1a2d4a",
                borderRadius: 10,
                marginBottom: 10
            }}>
                {filteredUsers.map(user => {
                    const selected = selectedUsers.some(u => u.user_id === user.user_id);

                    return (
                        <div
                            key={user.user_id}
                            onClick={() => toggleUser(user)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: 10,
                                cursor: "pointer",
                                background: selected ? "rgba(139,92,246,0.12)" : "transparent"
                            }}
                        >
                            <input type="checkbox" checked={selected} readOnly />
                            <Avatar name={user.username} size={26} online={user.is_online} />
                            <div style={{ color: "#cbd5e1", fontSize: 13 }}>
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
                style={{
                    minHeight: 130,
                    background: "#06101e",
                    border: "1px solid #1a2d4a",
                    color: "white",
                    padding: 10,
                    borderRadius: 10,
                    resize: "vertical",
                    marginBottom: 10
                }}
            />

            {/* SEND */}
            <button
                onClick={handleSend}
                disabled={!message.trim() || selectedUsers.length === 0}
                style={{
                    background: "rgba(139,92,246,0.2)",
                    border: "1px solid rgba(139,92,246,0.4)",
                    color: "#a78bfa",
                    padding: 10,
                    borderRadius: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: (!message.trim() || selectedUsers.length === 0) ? 0.5 : 1
                }}
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
        <div ref={dropdownRef} style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0,
            width: 280, background: "#0a1628",
            border: "1px solid #1a2d4a", borderRadius: 14,
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            zIndex: 100, overflow: "hidden",
        }}>
            {/* Search */}
            <div style={{ padding: "12px 12px 8px" }}>
                <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#334155" }}>🔍</span>
                    <input
                        autoFocus
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search users…"
                        style={{
                            width: "100%", background: "#06101e",
                            border: "1px solid #1a2d4a", color: "white",
                            padding: "8px 10px 8px 32px", borderRadius: 9,
                            fontSize: 13, outline: "none", boxSizing: "border-box",
                        }}
                    />
                </div>
            </div>

            {/* User list */}
            <div style={{ maxHeight: 260, overflowY: "auto", padding: "4px 0 8px" }}>
                {filtered.length === 0 ? (
                    <div style={{ padding: "20px 16px", textAlign: "center", color: "#334155", fontSize: 13 }}>No users found</div>
                ) : (
                    filtered.map(u => (
                        <div
                            key={u.user_id}
                            onClick={() => onStart(u)}
                            style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "8px 12px", cursor: "pointer",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "#0f1f38"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                            <Avatar name={u.username} size={32} online={u.is_online} />
                            <div>
                                <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{u.username}</div>
                                {u.email && <div style={{ color: "#334155", fontSize: 11 }}>{u.email}</div>}
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
    const [activeChat, setActiveChat] = useState(null);
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");
    const [showNewChat, setShowNewChat] = useState(false);
    const [loadingConvs, setLoadingConvs] = useState(true);

    const dropdownRef = useRef(null);
    const newChatBtnRef = useRef(null);
    const token = localStorage.getItem("token");

    const rawAccessPoints = localStorage.getItem("access_points");
    const currentAdminId = Number(localStorage.getItem("user_id")) || null;

    let accessPoints = rawAccessPoints;

    try {
            accessPoints = JSON.parse(rawAccessPoints);
            } catch (e) {
            accessPoints = rawAccessPoints;
            }
    const canViewAllUsers = hasPermission(accessPoints, "all.users.view");
    const canBroadcast =  hasPermission(accessPoints, "broadcast.message");


    // ── Derived stats ──
    const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
    const activeConvs = conversations.filter(c => c.last_time).length;

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
        loadUsers();
    }, [token, loadConversations]);

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
                last_message: "",
                unread_count: 0,
            });
            setShowNewChat(false);
            setSearch("");
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

    return (

            <div
                style={{
                    width: "100%",
                    height: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    background: "transparent",
                    overflow: "hidden",
                    padding: "5px"
                }}
            >


            {/* ═══ HEADER ════════════════════════════════════════ */}
            <div style={{
                flexShrink: 0,
                background: "transparent",
                padding: "0 14px 0",
                
            }}>
                {/* Top row: title + stat pills */}
                <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        gap: 14,  padding :"10px 0 20px 20px",  flexWrap: "wrap"
                    }}>
                        
                    {/* Stat pills */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft:20 }}>
                            <div>
                                <h1 style={{ color: "#2e7ce9af",margin: 0, fontSize: 26, fontWeight: 600, marginRight: 20 , letterSpacing: "0.1rem",}}>
                                    Messages
                                </h1>
                                <div style={{ color: "#64748b", fontSize: 13, margin: "2px 0 0" }}>
                                    Direct conversations &amp; broadcasts
                                </div>
                            </div>
                        <StatPill
                            icon={Users}
                            label="Active Users"
                            value={activeUsers.length}
                            accent="#22c55e"
                            loading={loadingConvs}
                        />
                        <StatPill
                            icon={MessagesSquare}
                            label="Conversations"
                            value={conversations.length}
                            accent="#3b82f6"
                            loading={loadingConvs}
                        />
                        
                        <StatPill
                            icon={Bell}
                            label="Unread"
                            value={totalUnread || "0"}
                            accent={totalUnread > 0 ? "#ef4444" : "#334155"}
                            loading={loadingConvs}
                        />
                    </div>
                </div>

                {/* Bottom row: action buttons */}
                <div style={{ 
                    
                    display: "flex", 
                    alignItems: "center", 
                    gap: 8, 
                    paddingBottom: 24 }}>
                    {/* New Chat button with dropdown */}
                    <div style={{ position: "relative" }}>
                        <button
                            ref={newChatBtnRef}
                            onClick={() => { setShowNewChat(v => !v); setSearch(""); }}
                            style={{
                                display: "flex", alignItems: "center", gap: 7,
                                background: showNewChat ? "rgba(59,130,246,0.25)" : "rgba(59,130,246,0.12)",
                                border: `1px solid ${showNewChat ? "#3b82f6" : "rgba(59,130,246,0.3)"}`,
                                color: showNewChat ? "white" : "#60a5fa",
                                borderRadius: 10, padding: "8px 16px",
                                cursor: "pointer", fontWeight: 600, fontSize: 13,
                                transition: "all 0.2s",
                            }}
                        >
                            <span style={{ fontSize: 15 }}><MessageCircle size={20}/></span>
                            New Chat
                            <span style={{
                                fontSize: 10, display: "inline-block",
                                transform: showNewChat ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 0.2s",
                            }}>▾</span>
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
                        <div style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                            borderRadius: 10, padding: "8px 14px", fontSize: 13, color: "#fca5a5",
                            fontWeight: 600,
                        }}>
                            <span style={{
                                background: "#ef4444", color: "white",
                                borderRadius: 99, fontSize: 11, fontWeight: 800,
                                padding: "1px 7px", minWidth: 18, textAlign: "center",
                            }}>{totalUnread}</span>
                            unread
                        </div>
                    )}

                </div>
            </div>

            {/* CENTER AREA (THIS IS THE FIX) */}
            <div
            style={{
                flex: 1,
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                padding: "20px 0",
                overflow: "hidden",
                marginLeft: "5px"
                
            }}
            >
            {/* CHAT CONTAINER */}
            <div
                style={{
                flex : 1,
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                maxHeight: "calc(100vh - 120px)", // prevents clipping
                color: "white",
                fontFamily: "'Inter', sans-serif",
                borderRadius: 15,
                overflow: "hidden",
                }}
            >

            {/* ═══ BODY ═══════════════════════════════════════════ */}
            <div style={{ 
                flex: 1,
                 display: "flex", 
                 overflow: "hidden" , 
                 background: "transparent", 
                 borderRadius: 15 , 
                 gap: 10,
                 
                 }}>

                {/* LEFT: Conversation list */}
                <div style={{
                    width: "25%",
                    display: "flex", 
                    flexDirection: "column",
                    background: "#0b1424", 
                    border: "1px solid #313d58bc",
                    overflow: "hidden",
                    borderRadius: 15
                    
                }}>
                    {/* Search bar inside sidebar */}
                    <div style={{ padding: "10px 12px", borderBottom: "1px solid #0d1e35" }}>
                        <div style={{ position: "relative" }}>
                            <span style={{
                                position: "absolute", left: 10, top: "50%",
                                transform: "translateY(-50%)", color: "#334155", fontSize: 13,
                            }}>🔍</span>
                            <input
                                placeholder="Search conversations…"
                                style={{
                                    width: "100%", background: "#06101e",
                                    border: "1px solid #0f1f38", color: "#cbd5e1",
                                    padding: "8px 10px 8px 32px", borderRadius: 9,
                                    fontSize: 13, outline: "none", boxSizing: "border-box",
                                    transition: "border-color 0.15s",
                                }}
                                onFocus={e => e.target.style.borderColor = "#1d3a6e"}
                                onBlur={e => e.target.style.borderColor = "#0f1f38"}
                            />
                        </div>
                    </div>

                    {/* Conversation list */}
                    <div style={{ 
                            flex: 1, 
                            overflowY: "auto", 
                            scrollbarWidth: "thin", 
                            scrollbarColor: "#0d1e35 transparent",
                            }}>
                            {loadingConvs ? (
                                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                                    {[1,2,3,4,5].map(i => (
                                        <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0" }}>
                                            <Sk w={40} h={40} r={20} />
                                            <div style={{ flex: 1 }}>
                                                <Sk w="60%" h={13} r={6} />
                                                <div style={{ marginTop: 6 }}><Sk w="90%" h={11} r={5} /></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : conversations.length === 0 ? (
                                <div style={{ padding: 32, textAlign: "center" }}>
                                    <div style={{ color: "#28528aff",fontSize: 36, marginBottom: 12 }}><MessagesSquare/></div>
                                    <div style={{ color: "#28528aff", fontWeight: 600, fontSize: 14 }}>No conversations yet</div>
                                    <div style={{ color: "#3a4962ff", fontSize: 12, marginTop: 6 }}>Start a new chat to begin</div>
                                </div>
                            ) : (
                                <ConversationList
                                    conversations={conversations}
                                    activeChat={activeChat}
                                    setActiveChat={(conv) => {
                                        setActiveChat(conv);
                                        // Mark as read
                                        setConversations(prev =>
                                            prev.map(c =>
                                                c.conversation_id === conv.conversation_id
                                                    ? { ...c, unread_count: 0 }
                                                    : c
                                            )
                                        );
                                    }}
                                />
                            )}
                        </div>
                    </div>

                {/* center: Chat window */}
                <div style={{ 
                    width: "50%",
                    display: "flex", 
                    flexDirection: "column", 
                    background: "#060d1a",  
                    border: "1px solid #34343dbe",
                    borderRadius: 15,
                    overflow: "hidden" ,
                    }}>
                    {activeChat ? (
                        <ChatWindow
                            activeChat={activeChat}
                            token={token}
                            refreshConversations={loadConversations}
                            mode="message"
                        />
                    ) : (
                        /* Empty state */
                        <div style={{
                            flex: 1, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", gap: 16,
                        }}>
                            <div style={{
                                width: 80, height: 80, borderRadius: 24,
                                background: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.12))",
                                border: "1px solid rgba(59,130,246,0.15)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 36, marginBottom: 8,
                            }}><MessagesSquare/></div>
                            <div style={{ color: "#334155", fontWeight: 700, fontSize: 18 }}>Select a conversation</div>
                            <div style={{ color: "#1e3a5f", fontSize: 13, textAlign: "center", maxWidth: 260, lineHeight: 1.7 }}>
                                Choose a conversation from the left, or start a new chat with any user.
                            </div>
                            <button
                                onClick={() => setShowNewChat(true)}
                                style={{
                                    marginTop: 8, display: "flex", alignItems: "center", gap: 8,
                                    background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)",
                                    color: "#60a5fa", borderRadius: 12, padding: "10px 22px",
                                    cursor: "pointer", fontWeight: 600, fontSize: 14,
                                    transition: "all 0.2s",
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.25)"}
                                onMouseLeave={e => e.currentTarget.style.background = "rgba(59,130,246,0.15)"}
                            >
                                ✏️ Start new chat
                            </button>
                        </div>
                    )}
                </div>

                   {/* RIGHT: Broadcast window */}
                <div style={{ 
                    width: "25%",
                    flex: 1, 
                    display: "flex", 
                    flexDirection: "column", 
                    background: "#060d1a", 
                    marginRight: "5px", 
  
                 border: "1px solid #34343dbe",
                    borderRadius: 15,
                    overflow: "auto" ,
                    }}>

                  <BroadcastPanel
                    users={users}
                    onSend={handleBroadcast}
                    canBroadcast={canBroadcast}
                />

                 </div>

            </div>

         

            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0 }
                    100% { background-position: -200% 0 }
                }
                * { box-sizing: border-box; }
                ::-webkit-scrollbar { width: 4px; height: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #0d1e35; border-radius: 4px; }
            `}</style>
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