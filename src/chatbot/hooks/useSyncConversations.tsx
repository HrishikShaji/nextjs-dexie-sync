import { useEffect } from "react";
import chatDB from "../local/chat-db";
import { syncConversations } from "../lib/syncConversations";

export default function useSyncConversations() {
	useEffect(() => {

		const autoSync = async () => {
			//			console.log("@@CONVERSATIONS-SYNCING CALLED")
			const unsyncedConversations = await chatDB.conversations
				.where("syncStatus")
				.equals("pending")
				.toArray();
			if (unsyncedConversations.length > 0) {
				console.log("@@SYNCING UNSYNCED CONVERSATIONS", unsyncedConversations)
				syncConversations({
					unsyncedConversations,
				});
			}
		};

		const interval = setInterval(autoSync, 1000);
		return () => clearInterval(interval);
	}, [syncConversations]);
}
