import { useMutation, useQueryClient } from "@tanstack/react-query";
import db from "@/local/db";

interface Item {
	id: string;
	name: string;
	syncStatus: "pending" | "synced" | "error";
	version: number;
	lastModified: number;
	deletedAt?: number;
	serverId?: number;
}

interface DeletedItem {
	id: string;
	deletedAt: number;
	syncStatus: "pending";
}

export const useDeleteItem = () => {
	const queryClient = useQueryClient();

	return useMutation<{ success: boolean }, Error, string>({
		mutationFn: async (id: string) => {
			try {
				// Get the item before deletion to store its info
				const item = await db.items.get(id);

				if (!item) throw new Error("Item not found");

				// Store deletion info in a separate table for syncing
				const deletedItem: DeletedItem = {
					id: item.id,
					deletedAt: Date.now(),
					syncStatus: "pending",
				};

				// Delete from items table
				await db.items.delete(id);

				// Store in deletions table
				await db.deletions.add(deletedItem);

				// Call your Next.js API route
				const response = await fetch('/api/items/delete', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ id }),
				});

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const result = await response.json();

				// Refresh local items
				const items = (await db.items.toArray()) as Item[];
				queryClient.setQueryData(["localItems"], items);

				return { success: true };
			} catch (error) {
				console.error("Delete mutation error:", error);
				throw error;
			}
		},
		onError: (error) => {
			console.error("Delete mutation error:", error);
		},
	});
};
