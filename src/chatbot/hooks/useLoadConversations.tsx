import { useEffect } from "react";
import chatDB from "../local/chat-db";
import { LocalConversation } from "../types/chat.type";
import { useConversationContext } from "../contexts/ConversationContext";

export default function useLoadConversations() {
	const { setConversations } = useConversationContext()
	useEffect(() => {
		loadConversations();
	}, []);

	const loadConversations = async () => {
		try {
			const localConversations = await chatDB.conversations.orderBy('localCreatedAt').reverse().toArray();
			const mappedConversations: LocalConversation[] = localConversations.map(conv => ({
				id: conv.id,
				title: conv.title,
				messages: conv.messages.map(msg => ({
					id: msg.id,
					text: msg.text,
					sender: msg.sender,
					syncStatus: msg.syncStatus
				})),
				syncStatus: conv.syncStatus,
				localCreatedAt: conv.localCreatedAt
			}));

			setConversations(mappedConversations);

		} catch (error) {
			console.error('Failed to load conversations from local storage:', error);
		}
	};

}
