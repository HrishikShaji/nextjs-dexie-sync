"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { LocalConversation, LocalMessage, MessageSyncResponse, SyncResponse, SyncResult } from "../types/chat.type";
import { generateAIResponse } from "../lib/generateAIResponse";
import { getSyncColor } from "@/lib/utils";
import ChatInput from "./ChatInput";
import useSyncMessages from "../hooks/useSyncMessages";
import { addMessagesToLocalDB } from "../lib/addMessagesToLocalDB";
import useLoadMessages from "../hooks/useLoadMessages";

interface Props {
	activeConversation: string;
}


export default function ChatInterface({ activeConversation }: Props) {
	const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const { isLoading } = useLoadMessages({
		activeConversation,
		inititalUserInput: localMessages.length === 1 ? localMessages[0].text : null,
		onMessages: (messages) => setLocalMessages(messages)
	})
	useSyncMessages({ onSuccess: (syncedMessages) => setLocalMessages(syncedMessages) })


	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [localMessages.length, scrollToBottom]);



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

			{/* Messages */}
			<div className="flex-1 p-6 overflow-y-auto bg-gray-50 scroll-smooth">
				{localMessages.map((message) => (
					<div
						key={message.id}
						className={`flex mb-4 ${message.sender === 'user' ? 'justify-end' : 'justify-start'
							}`}
					>
						<div
							className={`max-w-[70%] px-4 py-2 rounded-lg shadow-sm ${message.sender === 'user'
								? 'bg-blue-600 text-white rounded-br-sm'
								: 'bg-white text-gray-800 rounded-bl-sm border border-gray-200'
								}`}
						>
							<p className="whitespace-pre-wrap">{message.text}</p>
						</div>
						<div className={`size-2 rounded-full ${getSyncColor(message.syncStatus)}`} />
					</div>
				))
				}
				<div ref={messagesEndRef} />
			</div>

			{/* Message Input */}
			<ChatInput
				onSubmit={handleSendMessage}
				isProcessing={isProcessing || isLoading}
			/>

		</div>

	)
}
