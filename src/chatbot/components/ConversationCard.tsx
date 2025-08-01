import { getSyncColor } from "@/lib/utils";
import { Conversation, LocalConversation } from "../types/chat.type";
import { useCallback } from "react";
import { useConversationContext } from "../contexts/ConversationContext";
import { useRouter } from "next/navigation";
import chatDB from "../local/chat-db";

interface Props {
	conversation: LocalConversation;
}

export default function ConversationCard({ conversation }: Props) {

	const { activeConversation, setActiveConversation } = useConversationContext()

	const router = useRouter()

	const switchConversation = useCallback((conversationId: string) => {

		if (conversationId === activeConversation) {
			console.log("@@SAME CONVERATION ACTIVE")
			return;
		}
		console.log("@@SWITCHING CONVERSATION")
		setActiveConversation(conversationId);
		router.push(`/chat/${conversationId}`)

	}, [activeConversation]);


	const deleteConversation = useCallback(async (conversationId: string) => {

		try {
			console.log("@@DELETING CONVERSATION", conversationId)
			await chatDB.deleteQueue.add({
				id: conversationId,
				syncStatus: "pending"
			})
			await chatDB.conversations.delete(conversationId);
			if (activeConversation === conversationId) {
				router.push("/chat")
			}

		} catch (error) {
			console.error('@@FAILED TO DELETE LOCAL CONVERSATION:', error);

		}
	}, [activeConversation]);


	return (
		<div
			key={conversation.id}
			className={`flex justify-between items-center p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors duration-150 ${activeConversation === conversation.id
				? 'bg-blue-50 border-r-2 border-r-blue-600 font-medium'
				: ''
				}`}
			onClick={() => switchConversation(conversation.id)}
		>
			<div className="truncate flex-1">
				<span className="text-sm block truncate">
					{conversation.title}
				</span>
			</div>
			<button
				className="text-gray-400 hover:text-red-500 px-2 py-1 rounded transition-colors duration-150 ml-2"
				onClick={(e) => {
					e.stopPropagation()
					deleteConversation(conversation.id)
				}}
				title="Delete conversation"
			>
				×
			</button>
			<div className={`${getSyncColor(conversation.syncStatus)} size-4 rounded-full`} />
		</div>

	)
}
