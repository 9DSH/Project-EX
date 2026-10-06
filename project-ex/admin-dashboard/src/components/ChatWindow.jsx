import { useCallback, useEffect, useRef, useState } from "react";
import API from "../api/client";
import { Upload, ArrowLeft } from "lucide-react";
import "../pages/Messages.css";

export default function ChatWindow({
    activeChat,
    token,
    refreshConversations,
    mode,
    onBack, // optional: shown as a back button on mobile
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
            <div className="chat-empty">
                Select a conversation
            </div>
        );
    }

    return (
        <div className="chat-window">
            {/* HEADER */}
            {mode === "message" && (
                <div className="chat-header">
                    {onBack && (
                        <button
                            type="button"
                            className="msg-mobile-back"
                            onClick={onBack}
                            aria-label="Back to conversations"
                        >
                            <ArrowLeft size={18} />
                        </button>
                    )}

                    <div className="chat-header-name">
                        {activeChat.username}
                    </div>

                    {isInternal && (
                        <span className="chat-header-internal-tag">
                            INTERNAL
                        </span>
                    )}
                </div>
            )}

            {/* MESSAGES */}
            <div className="chat-messages">
                {messages.map((m) => {
                    const isMine = m.sender === mySender;

                    return (
                        <div
                            key={m.id}
                            className={`chat-bubble${isMine ? " mine" : ""}`}
                        >
                            {isInternal && (
                                <div className="chat-bubble-sender">
                                    {m.sender}
                                </div>
                            )}

                            {m.content && (
                                <div className="chat-bubble-content">
                                    {m.content}
                                </div>
                            )}

                            {m.media_url && (
                                <div className="chat-bubble-media">
                                    {m.media_type === "photo" && (
                                        <img
                                            src={getMediaUrl(m.media_url)}
                                            className="chat-bubble-image"
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
                                            className="chat-bubble-video"
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
                                            className="chat-bubble-doclink"
                                        >
                                            📎 Open attachment
                                        </a>
                                    )}
                                </div>
                            )}

                            <div className="chat-bubble-status">
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
            <div className="chat-input-row">
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
                    className="chat-upload-btn"
                >
                    <Upload size={18} />
                </button>

                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type message..."
                    className="chat-text-input"
                />

                <button
                    type="button"
                    onClick={sendMessage}
                    className="chat-send-btn"
                >
                    Send
                </button>
            </div>
        </div>
    );
}