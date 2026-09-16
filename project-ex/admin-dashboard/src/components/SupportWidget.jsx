import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { MessageCircle, Send, X, Paperclip } from "lucide-react";
import { API_URL } from "../config";

const WS_BASE = "ws://localhost:8000";
const api = axios.create({ baseURL: API_URL });
const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

const fmtTime = (value) => (value ? new Date(value).toLocaleString() : "—");

export default function SupportWidget() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role") || "user";
  const adminId = localStorage.getItem("user_id");

  // Master has no one above them to message — widget doesn't apply.
  if (role === "master" || role === "superadmin" || !token) return null;

  const [visible, setVisible] = useState(false); // controls mount + animation class
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const wsRef = useRef(null);
  const panelRef = useRef(null);
  const fabRef = useRef(null);

  // ── Mount/unmount with animation ──
  useEffect(() => {
    if (open) {
      setVisible(true);
    } else if (visible) {
      const t = setTimeout(() => setVisible(false), 180); // matches CSS transition below
      return () => clearTimeout(t);
    }
  }, [open]);

    // ── Close when clicking outside the panel/button ──
  useEffect(() => {
     if (!open) return undefined;
     const handleClick = (e) => {
       if (panelRef.current?.contains(e.target)) return;
       if (fabRef.current?.contains(e.target)) return;
       setOpen(false);
     };
     document.addEventListener("mousedown", handleClick);
     return () => document.removeEventListener("mousedown", handleClick);
   }, [open]);

  // ── WebSocket: watches indicators.master_messages for unread count ──
  useEffect(() => {
    if (!adminId) return;
    let cancelled = false;
    let retryTimer = null;
    let ws;

    const connect = () => {
      ws = new WebSocket(`${WS_BASE}/ws/admin/stats?admin_id=${adminId}`);
      wsRef.current = ws;
      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(event.data);
          const count = data?.indicators?.master_messages?.count ?? 0;
          setUnread(count);
        } catch (e) {
          console.error("SupportWidget: bad ws payload", e);
        }
      };
      ws.onclose = () => {
        if (cancelled) return;
        retryTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        if (ws.readyState === WebSocket.OPEN) ws.close();
      };
    };

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [adminId]);

  // ── Load thread when opened (backend marks master msgs as read on GET) ──
  const loadMessages = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin-master-messages/messages", { headers: authHeaders(token) });
      setMessages(Array.isArray(res.data?.messages) ? res.data.messages : []);
      setUnread(0);
    } catch (e) {
      console.error("Failed to load messages", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!text.trim() && !file) return;
    setSending(true);
    try {
      let mediaPayload = null;
      let mediaType = null;
      if (file) {
        mediaPayload = await fileToDataUrl(file);
        mediaType = file.type.startsWith("image/") ? "photo" : "document";
      }
      await api.post(
        "/admin-master-messages/send",
        { content: text.trim() || null, media_type: mediaType, media_file: mediaPayload },
        { headers: authHeaders(token) }
      );
      setText("");
      setFile(null);
      await loadMessages();
    } catch (e) {
      console.error("Failed to send message", e);
    } finally {
      setSending(false);
    }
  };

  const borderColor = unread > 0 ? "#f59e0b" : "rgba(255,255,255,.12)";

  return (
    <>
      <style>{`
        @keyframes supportPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,.45); }
          50% { box-shadow: 0 0 0 8px rgba(245,158,11,0); }
        }
        .support-bubble {
          transition: transform .15s cubic-bezier(.4,0,.2,1), box-shadow .15s ease;
          transform-origin: center;
        }
        .support-bubble:hover {
          transform: scale(1.035);
          box-shadow: 0 6px 18px rgba(0,0,0,.35);
        }
        .action-btn {
          transition: transform .15s cubic-bezier(.4,0,.2,1), box-shadow .15s ease;
        }
        .action-btn:hover {
          transform: scale(1.08);
          box-shadow: 0 6px 16px rgba(0,0,0,.4);
        }
        .action-btn:active {
          transform: scale(0.95);
        }
          .action-btn { transform: var(--fab-rot, none); }
        .action-btn:hover { transform: var(--fab-rot, none) scale(1.08); }
      `}</style>

      {visible && (
        <div
          ref={panelRef}
          style={{
            ...styles.panel,
            ...(open ? styles.panelOpen : styles.panelClosed),
          }}
        >
          <div style={styles.panelHeader}>
            <span style={styles.panelTitle}>Message to Master</span>

            <button
              type="button"
              className="action-btn"
              onClick={() => setOpen(false)}
              style={styles.iconBtn}
            >
              <X size={14} />
            </button>
          </div>

          <div style={styles.thread}>
            {loading && messages.length === 0 ? (
              <div style={styles.subtle}>Loading…</div>
            ) : messages.length === 0 ? (
              <div style={styles.subtle}>No messages yet. Say hi 👋</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="support-bubble" style={styles.bubble(m.sender === "admin")}>
                  <div style={styles.bubbleMeta}>{m.sender} · {fmtTime(m.created_at)}</div>
                  {m.content && <div>{m.content}</div>}
                  {m.media_url && (
                    <a href={`${API_URL}${m.media_url}`} target="_blank" rel="noreferrer" style={styles.link}>
                      Open attachment
                    </a>
                  )}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div style={styles.composeRow}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder="Write to master…"
              style={styles.textarea}
            />
            <div style={styles.composeActions}>
              <label style={styles.attachBtn} title="Attach photo">
                <Paperclip size={14} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  style={{ display: "none" }}
                />
              </label>
              {file && <span style={styles.fileName}>{file.name}</span>}
              <button type="button" className="action-btn" onClick={send} disabled={sending} style={styles.sendBtn}>
                <Send size={14} /> {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className="action-btn"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setOpen((v) => !v)}
        title="Message Master"
        style={{
          ...styles.fab,
          border: `2px solid ${borderColor}`,
          animation: unread > 0 ? "supportPulse 1.8s ease infinite" : "none",
          "--fab-rot": open ? "scale(0.92) rotate(-8deg)" : "scale(1) rotate(0deg)",
        }}
       >
        <MessageCircle size={22} color={unread > 0 ? "#f59e0b" : "#bfdbfe"} />
        {unread > 0 && <span style={styles.badge}>{unread > 99 ? "99+" : unread}</span>}
      </button>
    </>
  );
}

const styles = {
  fab: {
    position: "fixed",
    bottom: 22,
    right: 22,
    width: 54,
    height: 54,
    borderRadius: "50%",
    background: "#0d1424",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: 9500,
    boxShadow: "0 10px 30px rgba(0,0,0,.5)",
    transition: "transform .15s cubic-bezier(.4,0,.2,1)",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    padding: "0 4px",
    borderRadius: 9,
    background: "#f59e0b",
    color: "#04070d",
    fontSize: 10.5,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    position: "fixed",
    bottom: 88,
    right: 22,
    width: 390,
    maxHeight: 620,
    background: "#0d1424",
    border: "1px solid #1f2937",
    borderRadius: 16,
    boxShadow: "0 20px 50px rgba(0,0,0,.6)",
    display: "flex",
    flexDirection: "column",
    zIndex: 9500,
    overflow: "hidden",
    transformOrigin: "bottom right",
    transition: "opacity .18s cubic-bezier(.4,0,.2,1), transform .2s cubic-bezier(.4,0,.2,1)",
   },
  panelOpen: {
    opacity: 1,
    transform: "translateY(0) scale(1)",
  },
  panelClosed: {
    opacity: 0,
    transform: "translateY(12px) scale(.94)",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    borderBottom: "1px solid #1a2333",
  },
  panelTitle: { fontSize: 13, fontWeight: 800, color: "#e2e8f0" },
  iconBtn: {
    width: 26, height: 26, borderRadius: 8, border: "1px solid #223451", background: "#0b1628",
    color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
  thread: {
    flex: 1, minHeight: 320, maxHeight: 440, overflowY: "auto",
    display: "flex", flexDirection: "column", gap: 8, padding: 12,
  },
  subtle: { fontSize: 12, color: "#7c8ca8" },
  bubble: (mine) => ({
    alignSelf: mine ? "flex-end" : "flex-start",
    maxWidth: "82%",
    padding: 10,
    borderRadius: 12,
    fontSize: 12.5,
    border: `1px solid ${mine ? "rgba(59,130,246,.32)" : "#27364e"}`,
    background: mine ? "rgba(37,99,235,.18)" : "#091629",
    color: "white",
  }),
  bubbleMeta: { fontSize: 9.5, color: "#94a3b8", marginBottom: 4 },
  link: { color: "#93c5fd", display: "inline-block", marginTop: 6, fontSize: 11.5 },
  composeRow: { borderTop: "1px solid #1a2333", padding: 10, display: "grid", gap: 8 },
  textarea: {
    width: "100%", resize: "vertical", borderRadius: 10, border: "1px solid #29405e",
    background: "#081224", color: "white", padding: 8, fontSize: 12.5, boxSizing: "border-box",
  },
  composeActions: { display: "flex", alignItems: "center", gap: 8 },
  attachBtn: {
    width: 30, height: 30, borderRadius: 8, border: "1px solid #223451", background: "#0b1628",
    color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  fileName: { fontSize: 11, color: "#7c8ca8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 },
  sendBtn: {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10,
    border: "1px solid rgba(59,130,246,.4)", background: "rgba(37,99,235,.18)", color: "#bfdbfe",
    fontWeight: 800, fontSize: 12, cursor: "pointer", marginLeft: "auto",
  },
};