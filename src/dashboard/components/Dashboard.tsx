"use client"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import db from "@/local/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useDeleteItem } from "../hooks/useDeleteItem";
import { useSyncItems } from "../hooks/useSyncItems";
import { useInitialSync } from "../hooks/useInitialSync";

export default function Dashboard() {
	const [name, setName] = useState("");
	const { mutate: syncItems } = useSyncItems();
	const { mutate: deleteItem } = useDeleteItem();
	const queryClient = useQueryClient();

	// Initial sync on component mount
	const {
		data: initialSyncResult,
		isLoading: isInitialSyncing,
		error: initialSyncError
	} = useInitialSync();

	// Use React Query to manage local items state
	const { data: localItems = [] } = useQuery({
		queryKey: ["localItems"],
		queryFn: async () => {
			const items = await db.items.toArray();
			return items;
		},
		refetchOnWindowFocus: false,
		// Don't fetch until initial sync is complete
		enabled: !isInitialSyncing && !!initialSyncResult,
	});

	// Auto-sync effect - runs every 5 seconds to batch sync pending items
	useEffect(() => {
		// Don't start auto-sync until initial sync is complete
		if (isInitialSyncing) return;

		const autoSync = async () => {
			const unsyncedItems = await db.items
				.where("syncStatus")
				.equals("pending")
				.toArray();
			if (unsyncedItems.length > 0) {
				console.log("Auto-syncing batch of pending items:", unsyncedItems);
				syncItems(unsyncedItems);
			}
		};

		const interval = setInterval(autoSync, 5000); // Batch sync every 5 seconds
		return () => clearInterval(interval);
	}, [syncItems, isInitialSyncing]);

	const handleAdd = async (e: any) => {
		e.preventDefault();
		if (!name.trim()) return;

		const newItem = {
			id: crypto.randomUUID(),
			name: name.trim(),
			syncStatus: "pending" as const,
			version: 0,
			lastModified: Date.now(),
		};

		await db.items.add(newItem);
		// Refresh local items
		const items = await db.items.toArray();
		queryClient.setQueryData(["localItems"], items);
		setName("");
		// No immediate sync - will be picked up by next batch sync
	};

	const handleDelete = async (id: string) => {
		try {
			console.log("Deleting item:", id);
			await deleteItem(id);

			const items = await db.items.toArray();
			queryClient.setQueryData(["localItems"], items);
		} catch (error) {
			console.error("Error deleting item:", error);
		}
	};

	const handleSync = async () => {
		const unsyncedItems = await db.items
			.where("syncStatus")
			.equals("pending")
			.toArray();

		if (unsyncedItems.length > 0) {
			console.log("Manual sync of pending items:", unsyncedItems);
			syncItems(unsyncedItems);
		}
	};

	// Count pending items for UI feedback
	const pendingCount = localItems.filter(
		(item) => item.syncStatus === "pending"
	).length;

	// Show loading state during initial sync
	if (isInitialSyncing) {
		return (
			<div className="flex flex-col w-full justify-center items-center p-12">
				<div className="flex flex-col justify-center items-center max-w-3xl">
					<h1 className="text-2xl font-medium mb-4">Dexie local sync</h1>
					<div className="flex items-center gap-2">
						<div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
						<span>Syncing with server...</span>
					</div>
				</div>
			</div>
		);
	}

	// Show error state if initial sync failed
	if (initialSyncError) {
		return (
			<div className="flex flex-col w-full justify-center items-center p-12">
				<div className="flex flex-col justify-center items-center max-w-3xl">
					<h1 className="text-2xl font-medium mb-4">Dexie local sync</h1>
					<div className="text-red-500 mb-4">
						Failed to sync with server: {initialSyncError.message}
					</div>
					<Button onClick={() => window.location.reload()}>
						Retry
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col w-full justify-center items-center p-12">
			<div className="flex flex-col justify-center items-start max-w-3xl">
				<div className="flex justify-between">
					<h1 className="text-2xl font-medium">
						Dexie local sync
					</h1>
					{initialSyncResult && (
						<div className="text-sm text-green-600">
							Synced: {initialSyncResult.added} new, {initialSyncResult.updated} updated
						</div>
					)}
				</div>
				<form className="flex gap-2 py-4" onSubmit={handleAdd}>
					<Input
						type="text"
						placeholder="Name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="mr-2"
					/>
					<Button type="submit">Add Item</Button>
				</form>
				<div className="flex gap-4 py-4">
					<Button onClick={handleSync}>
						Sync to Server {pendingCount > 0 && `(${pendingCount} pending)`}
					</Button>
				</div>
				{localItems.length > 0 && <h2 className="text-lg mb-2">Items</h2>}
				<ul className="space-y-2 w-full">
					{localItems.map((item, index) => (
						<li
							key={item.id || index}
							className="flex items-center justify-between rounded-md border p-2"
						>
							<div className="flex flex-col">
								<p>{item.name}</p>
								{item.serverId && (
									<span className="text-xs text-gray-500">
										Server ID: {item.serverId}
									</span>
								)}
							</div>
							<div className="flex gap-2 items-center">
								<div className="flex items-center gap-2">
									<span
										className={`inline-flex h-2 w-2 rounded-full ${item.syncStatus === "synced"
											? "bg-green-500"
											: item.syncStatus === "pending"
												? "bg-yellow-500"
												: "bg-red-500"
											}`}
										title={`Sync Status: ${item.syncStatus}`}
									/>
								</div>
								<Button
									onClick={() => handleDelete(item.id)}
									variant="destructive"
								>
									Delete
								</Button>
							</div>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
