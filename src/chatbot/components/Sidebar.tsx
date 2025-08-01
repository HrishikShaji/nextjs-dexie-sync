"use client"
import ConversationCard from "./ConversationCard";
import Link from "next/link";
import chatDB from "../local/chat-db";
import { useLiveQuery } from "dexie-react-hooks";


export default function Sidebar() {
	const conversations = useLiveQuery(() => chatDB.conversations.orderBy('localCreatedAt').reverse().toArray()) || []

	return (
		<div className="w-64 bg-white border-r border-gray-200 flex flex-col">
			<div className="bg-white border-b border-gray-200 px-2 h-[60px] flex items-center">
				<Link
					className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors duration-150 shadow-sm"
					href="/chat"
				>
					+ New Chat
				</Link>
			</div>

			<div className="flex-1 overflow-y-auto">
				{conversations.map((conversation) => (
					<ConversationCard
						key={conversation.id}
						conversation={conversation}
					/>
				))}

				{conversations.length === 0 && (
					<div className="p-4 text-center text-gray-500 text-sm">
						No conversations yet.<br />
						Create your first chat!
					</div>
				)}
			</div>

			<div className="p-2 border-t border-gray-100 text-xs text-gray-400 text-center">
				{conversations.length} conversation{conversations.length !== 1 ? 's' : ''} stored locally
			</div>
		</div>

	)
}
