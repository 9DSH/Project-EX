import { useEffect, useRef, useState } from "react";
import API from "../api/client";
import {
  Upload
} from "lucide-react";

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

    const prevLengthRef = useRef(0);

    // ================= LOAD =================
    const loadMessages = async () => {
        if (!activeChat) return;

        try {
            const res = await API.get(
                `/admin/messages/conversation/${activeChat.conversation_id}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            
            console.log("CHAT RESPONSE:", res.data);
            setMessages(res.data.messages || []);
        } catch (err) {
            console.log(err);
        }
        
    };
    useEffect(() => {
        if (!activeChat) return;
        loadMessages();
    }, [activeChat]);

    // ================= SOCKET RELOAD EVENT =================
    useEffect(() => {
        const handler = (e) => {
            if (!activeChat) return;
            if (e.detail !== activeChat.conversation_id) return;

            loadMessages();
            refreshConversations();
        };

        window.addEventListener("reload_messages", handler);

        return () =>
            window.removeEventListener("reload_messages", handler);

    }, [activeChat]);


    useEffect(() => {
    if (!activeChat) return;

    loadMessages(); // initial load

    const interval = setInterval(() => {
        loadMessages(); // 🔥 keep chat updated
    }, 3000); // adjust: 2–5 sec recommended

    return () => clearInterval(interval);

}, [activeChat]);

    // ================= AUTO SCROLL =================
useEffect(() => {
    if (messages.length > prevLengthRef.current) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    prevLengthRef.current = messages.length;
}, [messages]);

    // ================= FILE =================
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {
            setMedia({
                type: file.type.startsWith("image")
                    ? "photo"
                    : file.type.startsWith("video")
                    ? "video"
                    : "document",
                file_data: reader.result
            });
        };

        reader.readAsDataURL(file);
    };

    // ================= SEND =================
    const sendMessage = async () => {
        if (!activeChat) return;
        if (!text.trim() && !media) return;

        try {
            await API.post(
                "/admin/messages/send",
                {
                    conversation_id: activeChat.conversation_id,
                    content: text,
                    media_type: media?.type || null,
                    media_file: media?.file_data || null
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            setText("");
            setMedia(null);

            refreshConversations();

        } catch (err) {
            console.log(err);
        }
    };

    const fileInputRef = useRef(null);

    // ================= UI =================
    if (!activeChat) {
        return (
            <div style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: "#6b7280"
            }}>
                Select a conversation
            </div>
        );
    }

    return (
        <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            width: "100%"
            
        }}>

            {/* HEADER */}
            {mode === "message" && activeChat && (
            <div style={{
                padding: 16,
                borderBottom: "1px solid #1f2937",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            }}>
                {activeChat.username}
            </div>
           ) }

            {/* MESSAGES */}
            <div style={{
                flex: 1,
                overflowY: "auto",
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: "#13152428"
            }}>
                {messages.map((m) => (
                    <div
                        key={m.id}
                        style={{
                            alignSelf: m.sender === "admin"
                                ? "flex-end"
                                : "flex-start",
                            background: m.sender === "admin"
                                ? "#2564eb50"
                                : "#1f2937",
                            padding: "10px 14px",
                            borderRadius: 12,
                            maxWidth: "60%"
                        }}
                    >
                        {m.content && <div>{m.content}</div>}

                        {m.media_url && (
                            <div style={{ marginTop: 8 }}>
                                {m.media_type === "photo" && (
                                    <img
                                        src={`http://localhost:8000${m.media_url}`}
                                        style={{ maxWidth: "200px", borderRadius: 8, cursor: "pointer" }}
                                        alt="photo"
                                        onClick={() => window.open(`http://localhost:8000${m.media_url}`, "_blank")}
                                    />
                                )}

                                {m.media_type === "video" && (
                                    <video
                                        src={`http://localhost:8000${m.media_url}`}
                                        controls
                                        style={{ maxWidth: "50%", borderRadius: 8 }}
                                    />
                                )}

                            </div>
                        )}

                        <div style={{
                            fontSize: 10,
                            opacity: 0.7,
                            marginTop: 4,
                            textAlign: "right"
                        }}>
                            {m.status === "seen" && "✔✔"}
                            {m.status === "delivered" && "✔✔"}
                            {m.status === "sent" && "✔"}
                        </div>
                    </div>
                ))}

                <div ref={bottomRef} />
            </div>

            {/* INPUT */}
            <div style={{
                display: "flex",
                padding: "7px 10px" ,
                gap: 10,
                justifyContent: "center",
                alignContent: "center",
                alignItems: "center",
                borderTop: "1px solid #1f2937",
                boxShadow: "0 20px 62px 15px rgba(0, 0, 0, 0.54)",
            }}>
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                />

                <button
                    onClick={() => fileInputRef.current?.click()}
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
                        cursor: "pointer"
                    }}
                >
                    <Upload/>
                </button>

                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Type message..."
                    style={{
                        flex: 1,
                        padding: 10,
                        borderRadius: 6
                    }}
                />

                <button
                    onClick={sendMessage}
                    style={{
                        padding: "10px 15px",
                        background: "#106c08ff",
                        color: "white",
                        border: "none",
                        borderRadius: 6
                    }}
                >
                    Send
                </button>
            </div>
        </div>
    );
}