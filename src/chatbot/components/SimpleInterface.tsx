"use client"
import { act, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import chatDB from "../local/chat-db";
import { useConversationContext } from "../contexts/ConversationContext";
import useWebSocket from "../hooks/useWebSocket";
import { LocalConversation, LocalMessage } from "../types/chat.type";
import { useLiveQuery } from "dexie-react-hooks";
import ChatMessages from "./ChatMessages";
import { addMessagesToLocalDB } from "../lib/addMessagesToLocalDB";
import { generateAIResponse } from "../lib/generateAIResponse";
import ChatInput from "./ChatInput";

interface Props {
	activeConversation: string;
}

export default function SimpleInterface({ activeConversation }: Props) {
	const [conversationId, setConversationId] = useState("")
	const [isProcessing, setIsProcessing] = useState(false);
	const [isCreatingConversation, setIsCreatingConversation] = useState(false)
	const { initialInput } = useConversationContext()
	const { syncConversation, isConnected, syncMessage } = useWebSocket()
	const workerRef = useRef<Worker>(null)


	useEffect(() => {
		if (activeConversation) {
			setConversationId(activeConversation)
		}
	}, [activeConversation])


	useEffect(() => {
		const worker = new Worker(new URL('../../worker/simple-worker.ts', import.meta.url));
		workerRef.current = worker
		console.log(workerRef.current)
		if (!conversationId || !isConnected || !initialInput || isCreatingConversation) return

		async function createConversation() {
			try {
				setIsCreatingConversation(true)

				// Check if conversation already exists
				const existingConversation = await chatDB.conversations.where("id").equals(conversationId).first()
				if (existingConversation) {
					console.log("Conversation already exists:", conversationId)
					return
				}

				const message: LocalMessage = {
					text: initialInput,
					id: crypto.randomUUID(),
					syncStatus: "pending",
					sender: "user"
				}

				const conversation: LocalConversation = {
					id: conversationId,
					title: initialInput,
					localCreatedAt: new Date(),
					messages: [message],
					syncStatus: "pending"
				}

				await chatDB.conversations.add(conversation);
				{/*
				if (workerRef.current) {
					workerRef.current.postMessage({
						type: "SYNC_MESSAGE"
					})
				}
			*/}
				syncConversation(conversation)
				const aiResponse = await generateAIResponse()
				const aiResponseObj: LocalMessage = {
					id: crypto.randomUUID(),
					text: aiResponse,
					sender: "ai",
					syncStatus: "pending"
				}

				await chatDB.conversations.where("id").equals(conversationId).modify((conversation) => {
					conversation.messages = [...conversation.messages, aiResponseObj]
				})
				syncMessage(aiResponseObj, conversationId)
				console.log("Successfully created conversation:", conversationId);
			} catch (error) {
				console.error("Error creating conversation:", error);
			} finally {
				setIsCreatingConversation(false)
			}
		}

		createConversation();
		return () => {
			if (workerRef.current) {
				workerRef.current.terminate();
			}
		};
	}, [conversationId, isConnected, initialInput]) // Removed syncConversation from dependencies

	const liveConversation = useLiveQuery(() =>
		chatDB.conversations.where("id").equals(conversationId).first(),
		[conversationId]
	)

	//console.log("@@LIVE CONVERSATION", liveConversation)
	const messages = liveConversation?.messages || []
	const handleSendMessage = async (inputValue: string) => {
		const trimmedInput = inputValue.trim();
		console.log("INPTUs", trimmedInput, isProcessing, conversationId)
		if (!trimmedInput || isProcessing || !conversationId) return;

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

		syncMessage(userMessage, conversationId)

		await addMessagesToLocalDB(
			conversationId,
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
			conversationId,
			[aiMessage],
			title
		);

		syncMessage(aiMessage, conversationId)

		setIsProcessing(false);


	};

	return (
		<div className="flex-1 flex flex-col">
			{/* Header */}
			<div className="bg-white border-b border-gray-200 px-2 h-[60px] flex items-center justify-between">
				{isConnected ? "Connected" : "Disconnected"}
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
