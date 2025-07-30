"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { LocalConversation, LocalMessage, MessageSyncResponse, SyncResponse, SyncResult } from "../types/chat.type";
import { generateAIResponse } from "../lib/generateAIResponse";
import ChatInput from "./ChatInput";
import useSyncMessages from "../hooks/useSyncMessages";
import { addMessagesToLocalDB } from "../lib/addMessagesToLocalDB";
import useLoadMessages from "../hooks/useLoadMessages";
import ChatMessages from "./ChatMessages";

interface Props {
	activeConversation: string;
}


export default function ChatInterface({ activeConversation }: Props) {
	const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);



	const { isLoading } = useLoadMessages({
		activeConversation,
		inititalUserInput: localMessages.length === 1 ? localMessages[0].text : null,
		onMessages: (messages) => setLocalMessages(messages)
	})

	useSyncMessages({ onSuccess: (syncedMessages) => setLocalMessages(syncedMessages) })



	const handleSendMessage = useCallback(async (inputValue: string) => {
		const trimmedInput = inputValue.trim();
		if (!trimmedInput || isProcessing || !activeConversation) return;

		let title;

		if (localMessages.length === 0) {
			title = trimmedInput
			//updateConversationTitle(title)
		}

		setIsProcessing(true);

		// Generate IDs upfront
		const userMessageId = crypto.randomUUID();
		const aiMessageId = crypto.randomUUID();

		// Create user message
		const userMessage: LocalMessage = {
			id: userMessageId,
			text: trimmedInput,
			sender: 'user',
			syncStatus: "pending", // Mark as local-only
		};

		// Immediately update UI with user message
		setLocalMessages(prev => [...prev, userMessage]);

		// Generate AI response (instant for demo)

		const aiResponseText = await generateAIResponse();
		const aiMessage: LocalMessage = {
			id: aiMessageId,
			text: aiResponseText,
			sender: 'ai',
			syncStatus: "pending", // Mark as local-only
		};

		// Add AI message to UI immediately for ultra-fast feel
		setLocalMessages(prev => [...prev, aiMessage]);

		// Update local state
		// Update database in background
		await addMessagesToLocalDB(
			activeConversation,
			[userMessage, aiMessage],
			title
		);

		setIsProcessing(false);

		// Refocus input for continuous typing
		setTimeout(() => inputRef.current?.focus(), 0);

	}, [isProcessing, activeConversation, generateAIResponse, addMessagesToLocalDB]);

	const activeConversationTitle = localMessages[0] ? localMessages[0].text : "No Title"

	return (
		<div className="flex-1 flex flex-col">
			{/* Header */}
			<div className="bg-white border-b border-gray-200 px-2 h-[60px] flex items-center">
				<h2 className="text-lg font-semibold text-gray-800 truncate">
					{activeConversationTitle}
				</h2>
			</div>

			<ChatMessages
				messages={localMessages}
			/>
			<ChatInput
				onSubmit={handleSendMessage}
				isProcessing={isProcessing || isLoading}
			/>

		</div>

	)
}
