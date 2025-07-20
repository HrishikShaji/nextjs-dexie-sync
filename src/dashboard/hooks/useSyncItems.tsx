import db from "@/local/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface SyncResult {
	id: number;
	status: string;
}

interface SyncResponse {
	success: boolean;
	results: SyncResult[];
}

export const useSyncItems = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (items: any[]) => {
			const itemsToSync = items.filter((item) => item.syncStatus === "pending");

			if (itemsToSync.length === 0) return;

			// Prepare items for sync by only including necessary fields
			const cleanItems = itemsToSync.map((item) => ({
				id: item.id,
				name: item.name,
			}));

			// Call your Next.js API route
			const response = await fetch('/api/items', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(cleanItems),
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
								const localItem = itemsToSync[index];
								// Update the local item with the server-generated ID
								await db.items.where("name").equals(localItem.name).modify({
									syncStatus: "synced",
									serverId: result.id,
									lastModified: Date.now(),
								});
								return { id: result.id, status: "synced" };
							} else {
								const localItem = itemsToSync[index];
								await db.items.where("name").equals(localItem.name).modify({
									syncStatus: "error",
									lastModified: Date.now(),
								});
								return { id: localItem.id, status: "error" };
							}
						}
					)
				);

				// Trigger a refresh of all items
				const allItems = await db.items.toArray();
				queryClient.setQueryData(["localItems"], allItems);
			} else {
				throw new Error("Failed to sync items");
			}
		},
	});
};
