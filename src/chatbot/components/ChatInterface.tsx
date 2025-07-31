"use client"

import { act, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { LocalConversation, LocalMessage, MessageSyncResponse, SyncResponse, SyncResult } from "../types/chat.type";
import { generateAIResponse } from "../lib/generateAIResponse";
import ChatInput from "./ChatInput";
import { addMessagesToLocalDB } from "../lib/addMessagesToLocalDB";
import ChatMessages from "./ChatMessages";
import chatDB from "../local/chat-db";
import { useLiveQuery } from "dexie-react-hooks"
import useWebSocket from "../hooks/useWebSocket";
import { useConversationContext } from "../contexts/ConversationContext";

interface Props {
	activeConversation: string;
}


export default function ChatInterface({ activeConversation }: Props) {
	const [isProcessing, setIsProcessing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const { syncMessage, syncConversation, isConnected } = useWebSocket()
	const { initialInput, setInitialInput } = useConversationContext()


	useEffect(() => {
		async function createConversation() {
			console.log("@@CONVERSATION RAN")

			// Check if conversation already exists
			const existingConversation = await chatDB.conversations.where("id").equals(activeConversation).first();
			console.log("@@EXISTING", existingConversation)
			if (!existingConversation) {
				const localConversation: LocalConversation = {
					id: activeConversation,
					title: initialInput,
					syncStatus: "pending",
					messages: [],
					localCreatedAt: new Date()
				};
				await chatDB.conversations.add(localConversation)
				syncConversation(localConversation)
			}

			setInitialInput("")
		}
		if (initialInput) {
			createConversation()
		}
	}, [initialInput])

	const liveConversation = useLiveQuery(() => chatDB.conversations.where("id").equals(activeConversation).first())

	const messages = liveConversation?.messages || []

	const handleSendMessage = useCallback(async (inputValue: string) => {
		const trimmedInput = inputValue.trim();
		if (!trimmedInput || isProcessing || !activeConversation) return;

		let title;

		if (messages.length === 0) {
			title = trimmedInput
			//updateConversationTitle(title)
		}
		const userMessageId = crypto.randomUUID();
		const userMessage: LocalMessage = {
			id: userMessageId,
			text: trimmedInput,
			sender: 'user',
			syncStatus: "pending", // Mark as local-only
		};

		syncMessage(userMessage)

		await addMessagesToLocalDB(
			activeConversation,
			[userMessage],
			title
		);
		setIsProcessing(true);

		const aiMessageId = crypto.randomUUID();


		const aiResponseText = await generateAIResponse();
		const aiMessage: LocalMessage = {
			id: aiMessageId,
			text: aiResponseText,
			sender: 'ai',
			syncStatus: "pending", // Mark as local-only
		};

		await addMessagesToLocalDB(
			activeConversation,
			[aiMessage],
			title
		);

		syncMessage(aiMessage)

		setIsProcessing(false);

		setTimeout(() => inputRef.current?.focus(), 0);

	}, [isProcessing, activeConversation, generateAIResponse, addMessagesToLocalDB]);

	const activeConversationTitle = messages[0] ? messages[0].text : "No Title"

	return (
		<div className="flex-1 flex flex-col">
			{/* Header */}
			<div className="bg-white border-b border-gray-200 px-2 h-[60px] flex items-center justify-between">
				<h2 className="text-lg font-semibold text-gray-800 truncate">
					{activeConversationTitle}
				</h2>
				<div>{isConnected ? "Connected" : "Disconnected"}</div>
			</div>

			<ChatMessages
				messages={messages}
			/>
			<ChatInput
				onSubmit={handleSendMessage}
				isProcessing={isProcessing}
			/>

		</div>

	)
}
