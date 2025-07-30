import { useEffect } from "react";
import { useConversationContext } from "../contexts/ConversationContext";
import chatDB from "../local/chat-db";
import { syncMessages } from "../lib/syncMessages";
import { LocalMessage } from "../types/chat.type";

interface Props {
	onSuccess: (messages: LocalMessage[]) => void;
}

export default function useSyncMessages({ onSuccess }: Props) {
	const { activeConversation } = useConversationContext()
	useEffect(() => {
		if (!activeConversation) return

		const autoSync = async () => {
			const conversation = await chatDB.conversations.get(activeConversation)
			if (!conversation) return
			const unsyncedMessages = conversation.messages.filter((msg) => msg.syncStatus === "pending");
			if (unsyncedMessages.length > 0 && activeConversation) {
				console.log("@@SYNCING UNSYNCED MESSAGES:", unsyncedMessages);
				syncMessages({
					unsyncedMessages,
					activeConversation,
					onSuccess
				})
			}
		};

		const interval = setInterval(autoSync, 1000);
		return () => clearInterval(interval);
	}, [activeConversation]);

}
