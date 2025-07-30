import { useEffect } from "react";
import chatDB from "../local/chat-db";
import { syncDeletions } from "../lib/syncDeletions";

export default function useSyncDeletions() {
	useEffect(() => {
		const autoSync = async () => {
			//			console.log("@@DELETIONS-SYNCING CALLED")
			const unsyncedDeletions = await chatDB.deleteQueue
				.where("syncStatus")
				.equals("pending")
				.toArray();
			if (unsyncedDeletions.length > 0) {
				const unsyncedDeletionIds = unsyncedDeletions.map((del) => del.id)
				console.log("@@SYNCING UNSYNCED DELETED ITEMS:", unsyncedDeletionIds);
				syncDeletions({ unsyncedDeletionIds })
			}
		};

		const interval = setInterval(autoSync, 5000);
		return () => clearInterval(interval);
	}, [syncDeletions])

}
