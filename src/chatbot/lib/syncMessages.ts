import chatDB from "../local/chat-db";
import { LocalMessage, MessageSyncResponse, SyncResult } from "../types/chat.type";

interface Props {
	unsyncedMessages: LocalMessage[];
	activeConversation: string;
	onSuccess: (messages: LocalMessage[]) => void;
}

export async function syncMessages({ unsyncedMessages, activeConversation, onSuccess }: Props) {
	//	console.log("@@UNSYNCED CONVERSATIONS", unsyncedMessages)


	const response = await fetch('/api/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ unsyncedMessages, conversationId: activeConversation }),
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	const { success, results }: MessageSyncResponse = await response.json();

	const syncedIds = results.map((sync) => sync.id)
	if (success) {
		// Update local items with sync status and server-generated IDs
		//		console.log("@@THESE ARE RESULTS", results)

		await chatDB.conversations.where("id").equals(activeConversation).modify((conversation) => {
			conversation.messages = conversation.messages.map((msg) => {
				const resultItem = results.find((result) => result.id === msg.id)
				if (!resultItem) return msg

				if (resultItem) {
					return {
						...msg,
						syncStatus: resultItem.status as any
					}
				}

				return msg
			})
		})

		// Trigger a refresh of all items
		const currentConversation = await chatDB.conversations.get(activeConversation);

		if (!currentConversation) return

		const allMessages = currentConversation.messages
		onSuccess(allMessages)

	} else {
		throw new Error("Failed to sync items");
	}
}
