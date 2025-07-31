import { useEffect, useRef, useState } from "react";
import { LocalConversation, LocalMessage } from "../types/chat.type";
import chatDB from "../local/chat-db";

async function onMessageSync(data: any) {
	console.log("@@MESSAGE-SYNC-RESPONSE:", data)
	await chatDB.conversations.where("id").equals(data.conversationId).modify((conversation) => {
		conversation.messages = conversation.messages.map((msg) => {
			if (msg.id === data.id) {
				return {
					...msg,
					syncStatus: data.status
				}
			}
			return msg
		})
	})
}

async function onConversationSync(data: any) {
	//	console.log("@@CONVERSATION-SYNC-RESPONSE", data)

	await chatDB.conversations.where("id").equals(data.id).modify({
		syncStatus: "synced",
	});
}

export default function useWebSocket() {
	const [isConnected, setIsConnected] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		const connectWebSocket = () => {
			wsRef.current = new WebSocket('ws://localhost:3001');

			wsRef.current.onopen = () => {
				setIsConnected(true);
				//				console.log('Connected to WebSocket');
			};

			wsRef.current.onmessage = async (event) => {
				try {
					const parsedData = JSON.parse(event.data)
					//					console.log("@@PARSED DATA", parsedData)
					switch (parsedData.type) {
						case "MESSAGE_SYNC_RESPONSE":
							await onMessageSync(parsedData.data);
							break;
						case "CREATE_CONVERSATION_RESPONSE":
							await onConversationSync(parsedData.data);
							break;
						default:
							//							console.log("Unknown message type:", parsedData.type);
							break;
					}
				} catch (error) {
					//					console.log("ERROR PARSING", error)
				}
			}

			wsRef.current.onclose = () => {
				setIsConnected(false);
				console.log('Disconnected from WebSocket');
			};

			wsRef.current.onerror = (error) => {
				console.log('WebSocket error:', error);
			};
		};

		connectWebSocket()


		return () => {
			if (wsRef.current) {
				wsRef.current.close();
			}
		};
	}, []);

	function syncMessage(message: LocalMessage, conversationId: string) {
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({
				type: "MESSAGE_SYNC_REQUEST",
				data: { ...message, conversationId }
			}))
		}
	}

	function syncConversation(conversation: LocalConversation) {
		//		console.log("THIS IS CALLED")
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			//			console.log("THIS IS CALLED")
			wsRef.current.send(JSON.stringify({
				type: "CREATE_CONVERSATION_REQUEST",
				data: conversation
			}))
		}
	}

	return {
		isConnected,
		syncMessage,
		syncConversation
	}
}
