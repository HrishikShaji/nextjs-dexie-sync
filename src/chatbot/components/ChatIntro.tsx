"use client"

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { useConversationContext } from "../contexts/ConversationContext";
import { LocalConversation, LocalMessage } from "../types/chat.type";
import chatDB from "../local/chat-db";
import ChatInput from "./ChatInput";

export default function ChatIntro() {
	const [isProcessing, setIsProcessing] = useState(false);
	const router = useRouter()
	const { setActiveConversation } = useConversationContext()

	async function handleFirstMessage(inputValue: string) {
		setIsProcessing(true)
		const id = crypto.randomUUID();
		const title = inputValue;

		const aiMessage: LocalMessage = {
			id: crypto.randomUUID(),
			text: inputValue,
			sender: 'user',
			syncStatus: "pending",
		};

		const localConversation: LocalConversation = {
			id,
			title,
			syncStatus: "pending",
			messages: [aiMessage],
			localCreatedAt: new Date()
		};

		try {
			const newConversations = await chatDB.conversations.add(localConversation);
			console.log("@@NEW CONVERSATIONS", newConversations)
			setActiveConversation(id);

			router.push(`/chat/${id}`)
		} catch (error) {
			console.error('Failed to create local conversation:', error);
			setActiveConversation(id);
		} finally {

		}


	}

	return (
		<div className="flex-1 flex flex-col">
			<div className="flex-1 p-6 overflow-y-auto flex items-center justify-center bg-gray-50 scroll-smooth">
				<div className="text-center mt-12 text-gray-500">
					<div className="bg-white rounded-lg p-8 shadow-sm max-w-md mx-auto">
						<h3 className="text-xl font-semibold mb-2 text-gray-700">
							Start a new conversation
						</h3>
						<p className="text-gray-600">
							Ask me anything and I'll respond instantly!
						</p>
					</div>
				</div>
			</div>
			<div className="p-4 border-t border-gray-200 bg-white">
				<ChatInput
					onSubmit={handleFirstMessage}
					isProcessing={isProcessing}
				/>
			</div>
		</div>
	)
}

