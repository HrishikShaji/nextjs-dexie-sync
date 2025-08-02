"use client"

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { useConversationContext } from "../contexts/ConversationContext";
import ChatInput from "./ChatInput";
import { LocalConversation } from "../types/chat.type";
import chatDB from "../local/chat-db";

export default function AdvancedIntro() {
	const [isProcessing, setIsProcessing] = useState(false);
	const router = useRouter()
	const { setActiveConversation, setInitialInput } = useConversationContext()

	async function startConversation(inputValue: string) {
		setIsProcessing(true)
		setInitialInput(inputValue)

		const id = crypto.randomUUID();

		setActiveConversation(id);

		const conversation: LocalConversation = {
			id,
			title: inputValue,
			initialPrompt: inputValue,
			localCreatedAt: new Date(),
			messages: [],
			syncStatus: "new"
		}

		await chatDB.conversations.add(conversation);

		router.push(`/chat/${id}`)

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
					onSubmit={startConversation}
					isProcessing={isProcessing}
				/>
			</div>
		</div>
	)
}

