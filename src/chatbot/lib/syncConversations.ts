import chatDB from "../local/chat-db";
import { LocalConversation, SyncResponse, SyncResult } from "../types/chat.type";

interface Props {
	unsyncedConversations: LocalConversation[];
	onSuccess: (conversations: LocalConversation[]) => void;
}

export async function syncConversations({ unsyncedConversations, onSuccess }: Props) {
	//	console.log("@@UNSYNCED CONVERSATIONS", unsyncedConversations)

	const response = await fetch('/api/conversations', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(unsyncedConversations),
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	const { success, results }: SyncResponse = await response.json();

	if (success) {
		// Update local items with sync status and server-generated IDs
		await Promise.all(
			results.map(
				async (result: SyncResult, index: number) => {
					if (result.status === "success") {
						const localItem = unsyncedConversations[index];
						// Update the local item with the server-generated ID
						await chatDB.conversations.where("id").equals(localItem.id).modify({
							syncStatus: "synced",
						});
						return { id: result.id, status: "synced" };
					} else {
						const localItem = unsyncedConversations[index];
						await chatDB.conversations.where("id").equals(localItem.id).modify({
							syncStatus: "error",
						});
						return { id: localItem.id, status: "error" };
					}
				}
			)
		);

		// Trigger a refresh of all items
		const allConversations = await chatDB.conversations.orderBy("localCreatedAt").reverse().toArray();
		onSuccess(allConversations)
	} else {
		throw new Error("Failed to sync items");
	}
}
