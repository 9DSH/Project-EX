import { useEffect } from "react";

export default function useMessagesSocket(onMessage) {
    useEffect(() => {
        const ws = new WebSocket("ws://127.0.0.1:8000/ws/messages");

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onMessage(data);
        };

        return () => ws.close();
    }, []);
}