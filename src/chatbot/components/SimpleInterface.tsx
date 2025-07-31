"use client"
import { act, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import chatDB from "../local/chat-db";
import { useConversationContext } from "../contexts/ConversationContext";
import useWebSocket from "../hooks/useWebSocket";
import { LocalConversation, LocalMessage } from "../types/chat.type";
import { useLiveQuery } from "dexie-react-hooks";
import ChatMessages from "./ChatMessages";

interface Props {
	activeConversation: string;
}

export default function SimpleInterface({ activeConversation }: Props) {
	const [conversationId, setConversationId] = useState("")
	const [isCreatingConversation, setIsCreatingConversation] = useState(false)
	const { initialInput } = useConversationContext()
	const { syncConversation, isConnected } = useWebSocket()

	useEffect(() => {
		if (activeConversation) {
			setConversationId(activeConversation)
		}
	}, [activeConversation])

	useEffect(() => {
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
				syncConversation(conversation)
				console.log("Successfully created conversation:", conversationId);
			} catch (error) {
				console.error("Error creating conversation:", error);
			} finally {
				setIsCreatingConversation(false)
			}
		}

		createConversation();
	}, [conversationId, isConnected, initialInput]) // Removed syncConversation from dependencies

	const liveConversation = useLiveQuery(() =>
		chatDB.conversations.where("id").equals(conversationId).first(),
		[conversationId]
	)

	console.log("@@LIVE CONVERSATION", liveConversation)
	const messages = liveConversation?.messages || []

	return (
		<div className="flex-1 flex flex-col">
			{/* Header */}
			<div className="bg-white border-b border-gray-200 px-2 h-[60px] flex items-center justify-between">
				{isConnected ? "Connected" : "Disconnected"}
			</div>
			<ChatMessages
				messages={messages}
			/>
		</div>
	)
}
