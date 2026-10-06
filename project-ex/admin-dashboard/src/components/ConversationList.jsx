import "../pages/Messages.css";

export default function ConversationList({
    conversations,
    activeChat,
    setActiveChat
}) {
    return (
        <div className="msg-list-scroll">
            {conversations.map((c) => {
                const isActive =
                    activeChat?.conversation_id === c.conversation_id;

                return (
                    <div
                        key={`${c.kind || "support"}-${c.conversation_id}`}
                        onClick={() => setActiveChat(c)}
                        className={`msg-list-row${isActive ? " active" : ""}`}
                    >
                        {/* LEFT: username */}
                        <div className="msg-list-row-name">
                            {c.username?.charAt(0).toUpperCase() + c.username?.slice(1)}
                            {c.kind === "internal" && (
                                <div className="msg-list-row-internal-tag">
                                    INTERNAL
                                </div>
                            )}
                        </div>

                        {/* MIDDLE: divider */}
                        <div className="msg-list-row-divider" />

                        {/* RIGHT: last message */}
                        <div
                            className={`msg-list-row-preview${c.isNew ? " is-new" : ""}`}
                        >
                            {c.last_message || "No messages yet"}
                        </div>

                        {/* UNREAD BADGE */}
                        {c.unread_count > 0 && (
                            <div className="msg-list-row-badge">
                                {c.unread_count}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}