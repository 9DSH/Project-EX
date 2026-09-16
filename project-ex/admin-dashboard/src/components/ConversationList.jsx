export default function ConversationList({
    conversations,
    activeChat,
    setActiveChat
}) {
    return (
        <div style={{ overflowY: "auto", height: "100%" }}>
            {conversations.map((c) => {
                const isActive =
                    activeChat?.conversation_id === c.conversation_id;

                return (
                    <div
                        key={c.conversation_id}
                        onClick={() => setActiveChat(c)}
                        style={{
                            padding: "12px 14px",
                            cursor: "pointer",
                            background: isActive
                                ? "rgba(59,130,246,0.10)"
                                : "transparent",
                            borderBottom: "1px solid #1a2336",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            minHeight: 64,
                        }}
                    >
                        {/* LEFT: username */}
                        <div
                            style={{
                                fontWeight: 700,
                                fontSize: 13,
                                color: isActive ? "#60a5fa" : "#e2e8f0",
                                minWidth: 80,
                                textAlign: "center",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                letterSpacing: 0.5,
                            }}
                        >
                            {c.username?.charAt(0).toUpperCase() + c.username?.slice(1)}
                            {c.kind === "internal" && (
                                <div style={{ fontSize: 9, color: "#f59e0b", fontWeight: 800, marginTop: 2 }}>
                                    INTERNAL
                                </div>
                            )}
                        
                        </div>

                        {/* MIDDLE: divider */}
                        <div
                            style={{
                                width: 1,
                                height: 32,
                                background: "#1f2a44",
                                flexShrink: 0,
                            }}
                        />

                        {/* RIGHT: last message */}
                        <div
                            style={{
                                flex: 1,
                                fontSize: 12,
                                color: c.isNew ? "#60a5fa" : "#94a3b8",
                                fontStyle: c.isNew ? "italic" : "normal",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {c.last_message || "No messages yet"}
                        </div>

                        {/* UNREAD BADGE */}
                        {c.unread_count > 0 && (
                            <div
                                style={{
                                    background: "#ef4444",
                                    color: "white",
                                    borderRadius: 99,
                                    padding: "2px 7px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    minWidth: 18,
                                    textAlign: "center",
                                    flexShrink: 0,
                                }}
                            >
                                {c.unread_count}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}