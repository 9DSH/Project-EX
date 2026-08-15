import axios from "axios";
import API from "./client";

// GET USERS
export const getUsers = async (token) => {
    const res = await API.get("/admin/messages/users", {
        headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
};

// START CONVERSATION
export const startConversation = async (user_id, token) => {
    const res = await API.post(
        "/admin/messages/start",
        null,
        {
            params: { user_id },
            headers: { Authorization: `Bearer ${token}` }
        }
    );
    return res.data;
};

// GET CONVERSATIONS
export const getConversations = async (token) => {
    const res = await API.get("/admin/messages/conversations", {
        headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
};

// GET SINGLE CONVERSATION
export const getConversation = async (id, token) => {
    const res = await API.get(`/admin/messages/conversation/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
};

export const sendMessage = async (id, content, token) => {

    console.log("========== SEND MESSAGE ==========");
    console.log("Conversation ID:", id);
    console.log("Content:", content);

    const payload = {
        conversation_id: id,
        content
    };

    console.log("Payload:", payload);

    const res = await API.post(
        "/admin/messages/send",
        payload,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    console.log("Response:", res.data);

    return res.data;
};