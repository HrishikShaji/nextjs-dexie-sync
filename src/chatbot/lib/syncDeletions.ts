
import chatDB from "../local/chat-db";
import { SyncResponse, SyncResult } from "../types/chat.type";

interface Props {
	unsyncedDeletionIds: string[];
}

export async function syncDeletions({ unsyncedDeletionIds }: Props) {
	console.log("@@UNSYNCED CONVERSATIONS", unsyncedDeletionIds)

	const response = await fetch('/api/conversations', {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(unsyncedDeletionIds),
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
						const deletionId = unsyncedDeletionIds[index];
						// Update the local item with the server-generated ID
						await chatDB.deleteQueue.where("id").equals(deletionId).modify({
							syncStatus: "synced",
						});
						return { id: result.id, status: "synced" };
					} else {
						const deletionId = unsyncedDeletionIds[index];
						await chatDB.deleteQueue.where("id").equals(deletionId).modify({
							syncStatus: "error",
						});
						return { id: deletionId, status: "error" };
					}
				}
			)
		);

	} else {
		throw new Error("Failed to sync items");
	}
}
