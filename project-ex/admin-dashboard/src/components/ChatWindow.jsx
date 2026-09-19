import { useCallback, useEffect, useRef, useState } from "react";
import API from "../api/client";
import { Upload } from "lucide-react";

export default function ChatWindow({
    activeChat,
    token,
    refreshConversations,
    mode,
}) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");
    const [media, setMedia] = useState(null);

    const bottomRef = useRef(null);
    const fileInputRef = useRef(null);
    const prevLengthRef = useRef(0);
    const loadingRef = useRef(false);

    const role = localStorage.getItem("role");
    const isMaster = role === "master";
    const isInternal = activeChat?.kind === "internal";

    // Which sender value represents "me" in this thread
    const mySender = isInternal
        ? (isMaster ? "master" : "admin")
        : "admin";

    // ================= LOAD =================
    const loadMessages = useCallback(async () => {
        if (!activeChat || !token) return;

        // Prevent overlapping polling requests
        if (loadingRef.current) return;

        loadingRef.current = true;

        try {
            let res;

            if (isInternal) {
                if (isMaster) {
                    res = await API.get(
                        `/admin-master-messages/inbox/${activeChat.conversation_id}`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        }
                    );
                } else {
                    res = await API.get(
                        `/admin-master-messages/messages`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        }
                    );
                }
            } else {
                res = await API.get(
                    `/admin/messages/conversation/${activeChat.conversation_id}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );
            }

            setMessages(res.data?.messages || []);
        } catch (err) {
            console.error("Failed to load messages:", err);
        } finally {
            loadingRef.current = false;
        }
    }, [
        activeChat,
        token,
        isInternal,
        isMaster,
    ]);

    // ================= INITIAL / CHAT CHANGE =================
    useEffect(() => {
        if (!activeChat) {
            setMessages([]);
            return;
        }

        prevLengthRef.current = 0;
        loadMessages();
    }, [activeChat, loadMessages]);

    // ================= SOCKET RELOAD EVENT =================
    useEffect(() => {
        if (!activeChat) return;

        const handler = (e) => {
            if (e.detail !== activeChat.conversation_id) return;

            loadMessages();

            if (typeof refreshConversations === "function") {
                refreshConversations();
            }
        };

        window.addEventListener("reload_messages", handler);

        return () => {
            window.removeEventListener("reload_messages", handler);
        };
    }, [
        activeChat,
        loadMessages,
        refreshConversations,
    ]);

    // ================= POLLING =================
    useEffect(() => {
        if (!activeChat) return;

        const interval = setInterval(() => {
            loadMessages();
        }, 3000);

        return () => {
            clearInterval(interval);
        };
    }, [activeChat, loadMessages]);

    // ================= AUTO SCROLL =================
    useEffect(() => {
        if (messages.length > prevLengthRef.current) {
            bottomRef.current?.scrollIntoView({
                behavior: "smooth",
            });
        }

        prevLengthRef.current = messages.length;
    }, [messages]);

    // ================= FILE =================
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];

        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {
            setMedia({
                type: file.type.startsWith("image/")
                    ? "photo"
                    : file.type.startsWith("video/")
                        ? "video"
                        : "document",
                file_data: reader.result,
                file_name: file.name,
                mime_type: file.type,
            });
        };

        reader.onerror = () => {
            console.error("Failed to read selected file.");
            setMedia(null);
        };

        reader.readAsDataURL(file);

        // Allow selecting the same file again
        e.target.value = "";
    };

    // ================= SEND =================
    const sendMessage = async () => {
        if (!activeChat || !token) return;

        if (!text.trim() && !media) return;

        try {
            if (isInternal) {
                const url = isMaster
                    ? `/admin-master-messages/inbox/${activeChat.conversation_id}/send`
                    : `/admin-master-messages/send`;

                await API.post(
                    url,
                    {
                        content: text.trim() || null,
                        media_type: media?.type || null,
                        media_file: media?.file_data || null,
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );
            } else {
                await API.post(
                    "/admin/messages/send",
                    {
                        conversation_id: activeChat.conversation_id,
                        content: text.trim() || null,
                        media_type: media?.type || null,
                        media_file: media?.file_data || null,
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );
            }

            setText("");
            setMedia(null);

            await loadMessages();

            if (typeof refreshConversations === "function") {
                refreshConversations();
            }
        } catch (err) {
            console.error("Failed to send message:", err);
        }
    };

    // ================= MEDIA URL =================
    const getMediaUrl = (url) => {
        if (!url) return "";

        if (
            url.startsWith("http://") ||
            url.startsWith("https://")
        ) {
            return url;
        }

        // Uses Vite environment variable if available.
        // Falls back to localhost for local development.
        const baseUrl =
            import.meta.env.VITE_API_URL || "http://localhost:8000";

        return `${baseUrl.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
    };

    // ================= KEYBOARD =================
    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // ================= UI =================
    if (!activeChat) {
        return (
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    color: "#6b7280",
                }}
            >
                Select a conversation
            </div>
        );
    }

    return (
        <div
            style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: "100%",
                minWidth: 0,
            }}
        >
            {/* HEADER */}
            {mode === "message" && (
                <div
                    style={{
                        padding: 16,
                        borderBottom: "1px solid #1f2937",
                        boxShadow:
                            "0 8px 32px rgba(0, 0, 0, 0.4)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <div
                        style={{
                            fontWeight: 600,
                        }}
                    >
                        {activeChat.username}
                    </div>

                    {isInternal && (
                        <span
                            style={{
                                fontSize: 9,
                                fontWeight: 800,
                                color: "#f59e0b",
                                background:
                                    "rgba(245,158,11,0.12)",
                                border:
                                    "1px solid rgba(245,158,11,0.3)",
                                borderRadius: 999,
                                padding: "2px 7px",
                            }}
                        >
                            INTERNAL
                        </span>
                    )}
                </div>
            )}

            {/* MESSAGES */}
            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    background: "#13152428",
                }}
            >
                {messages.map((m) => {
                    const isMine = m.sender === mySender;

                    return (
                        <div
                            key={m.id}
                            style={{
                                alignSelf: isMine
                                    ? "flex-end"
                                    : "flex-start",
                                background: isMine
                                    ? "#2564eb50"
                                    : "#1f2937",
                                padding: "10px 14px",
                                borderRadius: 12,
                                maxWidth: "60%",
                                overflowWrap: "anywhere",
                            }}
                        >
                            {isInternal && (
                                <div
                                    style={{
                                        fontSize: 10,
                                        opacity: 0.6,
                                        marginBottom: 4,
                                        textTransform: "capitalize",
                                    }}
                                >
                                    {m.sender}
                                </div>
                            )}

                            {m.content && (
                                <div
                                    style={{
                                        whiteSpace: "pre-wrap",
                                    }}
                                >
                                    {m.content}
                                </div>
                            )}

                            {m.media_url && (
                                <div
                                    style={{
                                        marginTop: 8,
                                    }}
                                >
                                    {m.media_type === "photo" && (
                                        <img
                                            src={getMediaUrl(m.media_url)}
                                            style={{
                                                maxWidth: "200px",
                                                maxHeight: "300px",
                                                objectFit: "contain",
                                                borderRadius: 8,
                                                cursor: "pointer",
                                            }}
                                            alt="attachment"
                                            onClick={() =>
                                                window.open(
                                                    getMediaUrl(
                                                        m.media_url
                                                    ),
                                                    "_blank",
                                                    "noopener,noreferrer"
                                                )
                                            }
                                        />
                                    )}

                                    {m.media_type === "video" && (
                                        <video
                                            src={getMediaUrl(
                                                m.media_url
                                            )}
                                            controls
                                            style={{
                                                maxWidth: "100%",
                                                maxHeight: "300px",
                                                borderRadius: 8,
                                            }}
                                        />
                                    )}

                                    {(
                                        m.media_type === "document" ||
                                        m.media_type === "receipt"
                                    ) && (
                                        <a
                                            href={getMediaUrl(
                                                m.media_url
                                            )}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                                color: "#93c5fd",
                                                fontSize: 12,
                                            }}
                                        >
                                            📎 Open attachment
                                        </a>
                                    )}
                                </div>
                            )}

                            <div
                                style={{
                                    fontSize: 10,
                                    opacity: 0.7,
                                    marginTop: 4,
                                    textAlign: "right",
                                }}
                            >
                                {m.status === "seen" && "✔✔"}
                                {m.status === "delivered" && "✔✔"}
                                {m.status === "sent" && "✔"}
                            </div>
                        </div>
                    );
                })}

                <div ref={bottomRef} />
            </div>

            {/* INPUT */}
            <div
                style={{
                    display: "flex",
                    padding: "7px 10px",
                    gap: 10,
                    justifyContent: "center",
                    alignContent: "center",
                    alignItems: "center",
                    borderTop: "1px solid #1f2937",
                    boxShadow:
                        "0 20px 62px 15px rgba(0, 0, 0, 0.54)",
                }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                />

                <button
                    type="button"
                    onClick={() =>
                        fileInputRef.current?.click()
                    }
                    style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        border: "1px solid #3c4a5eff",
                        background: "#111827",
                        color: "#9ca3af",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                    }}
                >
                    <Upload size={18} />
                </button>

                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type message..."
                    style={{
                        flex: 1,
                        minWidth: 0,
                        padding: 10,
                        borderRadius: 6,
                    }}
                />

                <button
                    type="button"
                    onClick={sendMessage}
                    style={{
                        padding: "10px 15px",
                        background: "#106c08ff",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                    }}
                >
                    Send
                </button>
            </div>
        </div>
    );
}