"use client"
import { act, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import chatDB from "../local/chat-db";
import { LocalConversation, LocalMessage } from "../types/chat.type";
import { useLiveQuery } from "dexie-react-hooks";
import ChatMessages from "./ChatMessages";
import { generateAIResponse } from "../lib/generateAIResponse";
import ChatInput from "./ChatInput";

interface Props {
	activeConversation: string;
}

async function addMessage({ message, conversationId }: { message: LocalMessage; conversationId: string }) {
	await chatDB.conversations.where("id").equals(conversationId).modify((conversation) => {
		conversation.syncStatus = "pending";
		conversation.messages = [...conversation.messages, message];
	})

}

export default function AdvancedInterface({ activeConversation }: Props) {
	const [isProcessing, setIsProcessing] = useState(false);


	const liveConversation = useLiveQuery(() =>
		chatDB.conversations.where("id").equals(activeConversation).first(),
		[activeConversation]
	)

	const messages = liveConversation?.messages || []
	const conversationId = liveConversation?.id


	useEffect(() => {
		if (liveConversation && liveConversation.initialPrompt && messages.length === 0) {
			handleSendMessage(liveConversation.initialPrompt)
		}
	}, [liveConversation])

	async function handleSendMessage(inputValue: string) {

		if (!conversationId) return

		try {
			setIsProcessing(true);
			const userMessage: LocalMessage = {
				id: crypto.randomUUID(),
				text: inputValue,
				sender: 'user',
				syncStatus: "pending",
			};
			await addMessage({ message: userMessage, conversationId })


			const aiResponseText = await generateAIResponse();
			const aiMessage: LocalMessage = {
				id: crypto.randomUUID(),
				text: aiResponseText,
				sender: 'ai',
				syncStatus: "pending",
			};
			await addMessage({ message: aiMessage, conversationId })


		} catch (error) {
			console.log("@@ERROR", error)
		} finally {
			setIsProcessing(false);

		}
	};

	if (!liveConversation) return null

	return (
		<div className="flex-1 flex flex-col">
			<div className="bg-white border-b border-gray-200 px-2 h-[60px] flex items-center justify-between">
				{liveConversation.title}
			</div>
			<ChatMessages
				messages={messages}
			/>
			<ChatInput
				isProcessing={isProcessing}
				onSubmit={handleSendMessage}
			/>
		</div>
	)
}
