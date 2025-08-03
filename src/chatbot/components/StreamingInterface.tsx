"use client"
import { act, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import chatDB from "../local/chat-db";
import { LocalConversation, LocalMessage } from "../types/chat.type";
import { useLiveQuery } from "dexie-react-hooks";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import { streamChatResponse } from "../lib/streamingService";
import StreamingChatMessages from "./StreamingChatMessages";

interface Props {
	activeConversation: string;
}

async function addMessage({ message, conversationId }: { message: LocalMessage; conversationId: string }) {
	await chatDB.conversations.where("id").equals(conversationId).modify((conversation) => {
		conversation.syncStatus = "pending";
		conversation.messages = [...conversation.messages, message];
	})
}

async function updateLastMessage({ content, conversationId }: { content: string; conversationId: string }) {
	await chatDB.conversations.where("id").equals(conversationId).modify((conversation) => {
		if (conversation.messages.length > 0) {
			const lastMessage = conversation.messages[conversation.messages.length - 1];
			if (lastMessage.sender === 'ai') {
				lastMessage.text += content;
			}
		}
	});
}

async function finalizeLastMessage({ conversationId }: { conversationId: string }) {
	await chatDB.conversations.where("id").equals(conversationId).modify((conversation) => {
		if (conversation.messages.length > 0) {
			const lastMessage = conversation.messages[conversation.messages.length - 1];
			if (lastMessage.sender === 'ai') {
				lastMessage.syncStatus = "synced";
			}
		}
		conversation.syncStatus = "synced";
	});
}

export default function StreamingInterface({ activeConversation }: Props) {
	const [isProcessing, setIsProcessing] = useState(false);
	const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

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

			// Add user message
			const userMessage: LocalMessage = {
				id: crypto.randomUUID(),
				text: inputValue,
				sender: 'user',
				syncStatus: "pending",
			};
			await addMessage({ message: userMessage, conversationId });

			// Create placeholder AI message
			const aiMessageId = crypto.randomUUID();
			const aiMessage: LocalMessage = {
				id: aiMessageId,
				text: '',
				sender: 'ai',
				syncStatus: "pending",
			};
			await addMessage({ message: aiMessage, conversationId });
			setStreamingMessageId(aiMessageId);

			// Prepare messages for API
			const apiMessages = [...messages, userMessage].map(msg => ({
				role: msg.sender === 'user' ? 'user' : 'assistant',
				content: msg.text
			}));

			// Start streaming
			await streamChatResponse(apiMessages, conversationId, {
				onStart: () => {
					console.log('Streaming started');
				},
				onContent: async (content: string) => {
					await updateLastMessage({ content, conversationId });
				},
				onComplete: async () => {
					await finalizeLastMessage({ conversationId });
					setStreamingMessageId(null);
					setIsProcessing(false);
				},
				onError: async (error: string) => {
					console.error('Streaming error:', error);
					// Update the AI message with error
					await chatDB.conversations.where("id").equals(conversationId).modify((conversation) => {
						if (conversation.messages.length > 0) {
							const lastMessage = conversation.messages[conversation.messages.length - 1];
							if (lastMessage.sender === 'ai' && lastMessage.id === aiMessageId) {
								lastMessage.text = `Error: ${error}`;
								lastMessage.syncStatus = "error";
							}
						}
					});
					setStreamingMessageId(null);
					setIsProcessing(false);
				}
			});

		} catch (error) {
			console.error("@@ERROR", error);
			setIsProcessing(false);
			setStreamingMessageId(null);
		}
	}

	if (!liveConversation) return null

	return (
		<div className="flex-1 flex flex-col">
			<div className="bg-white border-b border-gray-200 px-2 h-[60px] flex items-center justify-between">
				{liveConversation.title}
			</div>
			<StreamingChatMessages
				messages={messages}
				streamingMessageId={streamingMessageId}
			/>
			<ChatInput
				isProcessing={isProcessing}
				onSubmit={handleSendMessage}
			/>
		</div>
	)
}
