import { Conversation } from "../types/chat.type";

interface Props {
	activeConversation: string | null;
	conversation: Conversation;
	switchConversation: (conversationId: string) => void;
	deleteConversation: (converationId: string) => void;
}

export default function ConversationCard({ activeConversation, conversation, switchConversation, deleteConversation }: Props) {
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
		</div>

	)
}
