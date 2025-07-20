import db from "@/local/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ServerItem {
	id: number;
	name: string;
	created_at?: string;
	updated_at?: string;
}

export const useInitialSync = () => {
	const queryClient = useQueryClient();

	return useQuery({
		queryKey: ["initialSync"],
		queryFn: async () => {
			try {
				console.log("Starting initial sync...");

				// Fetch items from server
				const response = await fetch('/api/items', {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				});

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const serverItems: ServerItem[] = await response.json();
				console.log("Server items fetched:", serverItems);

				// Get existing local items
				const localItems = await db.items.toArray();
				console.log("Local items found:", localItems);

				// Create a map of local items by serverId for quick lookup
				const localItemsByServerId = new Map();
				const localItemsByName = new Map();

				localItems.forEach(item => {
					if (item.serverId) {
						localItemsByServerId.set(item.serverId, item);
					}
					localItemsByName.set(item.name, item);
				});

				// Process server items
				const itemsToAdd = [];
				const itemsToUpdate = [];

				for (const serverItem of serverItems) {
					const existingLocalItem = localItemsByServerId.get(serverItem.id);

					if (existingLocalItem) {
						// Item exists locally with this serverId - check if update needed
						if (existingLocalItem.syncStatus === "pending") {
							// Don't overwrite pending local changes
							console.log(`Skipping server item ${serverItem.id} - local changes pending`);
							continue;
						}

						// Update local item if needed (you can add timestamp comparison here)
						itemsToUpdate.push({
							localId: existingLocalItem.id,
							serverData: serverItem
						});
					} else {
						// Check if an item with the same name exists locally but without serverId
						const duplicateByName = localItemsByName.get(serverItem.name);

						if (duplicateByName && !duplicateByName.serverId) {
							// Link existing local item to server item
							await db.items.where("id").equals(duplicateByName.id).modify({
								serverId: serverItem.id,
								syncStatus: "synced",
								lastModified: Date.now(),
							});
							console.log(`Linked local item "${serverItem.name}" to server ID ${serverItem.id}`);
						} else {
							// New item from server - add to local
							itemsToAdd.push({
								id: crypto.randomUUID(),
								name: serverItem.name,
								serverId: serverItem.id,
								syncStatus: "synced" as const,
								version: 0,
								lastModified: Date.now(),
							});
						}
					}
				}

				// Add new items to local database
				if (itemsToAdd.length > 0) {
					await db.items.bulkAdd(itemsToAdd);
					console.log(`Added ${itemsToAdd.length} new items from server`);
				}

				// Update existing items
				for (const updateItem of itemsToUpdate) {
					await db.items.where("id").equals(updateItem.localId).modify({
						name: updateItem.serverData.name,
						syncStatus: "synced",
						lastModified: Date.now(),
					});
				}

				if (itemsToUpdate.length > 0) {
					console.log(`Updated ${itemsToUpdate.length} items from server`);
				}

				// Refresh the localItems query
				const updatedItems = await db.items.toArray();
				queryClient.setQueryData(["localItems"], updatedItems);

				console.log("Initial sync completed successfully");
				return {
					success: true,
					added: itemsToAdd.length,
					updated: itemsToUpdate.length,
					total: serverItems.length
				};

			} catch (error) {
				console.error("Initial sync failed:", error);
				throw error;
			}
		},
		staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
		refetchOnWindowFocus: false,
		refetchOnMount: true,
		retry: 3,
	});
};
