import { useEffect } from "react";
import chatDB from "../local/chat-db";
import { syncConversations } from "../lib/syncConversations";
import { useConversationContext } from "../contexts/ConversationContext";

export default function useSyncConversations() {
	const { setConversations } = useConversationContext()
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
					onSuccess: (conversations) => setConversations(conversations)
				});
			}
		};

		const interval = setInterval(autoSync, 5000);
		return () => clearInterval(interval);
	}, [syncConversations]);
}
