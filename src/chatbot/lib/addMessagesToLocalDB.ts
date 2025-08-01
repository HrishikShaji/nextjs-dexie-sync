import chatDB from "../local/chat-db";
import { LocalMessage } from "../types/chat.type";

export const addMessagesToLocalDB = async (
	conversationId: string,
	newMessages: LocalMessage[],
	newTitle?: string
) => {
	try {
		console.log("@@FIRED THIS")
		// Update locally in IndexedDB
		await chatDB.conversations
			.where('id')
			.equals(conversationId)
			.modify(conversation => {
				conversation.syncStatus = "pending";
				conversation.messages = [...conversation.messages, ...newMessages];
				if (newTitle) conversation.title = newTitle;
			});
	} catch (error) {
		console.error('Failed to update local conversation:', error);
		// Could implement retry logic or queue for later
	}
};
