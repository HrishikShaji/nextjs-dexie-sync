
"use client"

import { act, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import chatDB from "../local/chat-db";
import { useConversationContext } from "../contexts/ConversationContext";
import useWebSocket from "../hooks/useWebSocket";
import { LocalConversation } from "../types/chat.type";
import { useSearchParams } from "next/navigation";

interface Props {
	activeConversation: string;
}

export default function SimpleInterface({ activeConversation }: Props) {
	const [conversationId, setConversationId] = useState("")
	const { syncConversation, isConnected } = useWebSocket()

	useEffect(() => {
		if (activeConversation) {
			setConversationId(activeConversation)
		}
	}, [activeConversation])


	useEffect(() => {
		if (!conversationId || !isConnected) return

		async function createConversation() {

			try {

				const conversation: LocalConversation = {
					id: conversationId,
					title: "sample",
					localCreatedAt: new Date(),
					messages: [],
					syncStatus: "pending"
				}
				await chatDB.conversations.add(conversation);
				syncConversation(conversation)
				console.log("Successfully created conversation:", conversationId);
			} catch (error) {
				console.error("Error details:", error);
			}
		}

		createConversation();


	}, [conversationId, isConnected, syncConversation])

	{/*
	useEffect(() => {
		let cancelled = false;

		async function createConversation() {
			if (cancelled) return;

			console.log("@@CONVERSATION RAN for:", activeConversation)

			try {
				const existing = await chatDB.conversations.get(activeConversation);

				if (!existing && !cancelled) {
					const conversation: LocalConversation = {
						id: activeConversation,
						title: "sample",
						localCreatedAt: new Date(),
						messages: [],
						syncStatus: "pending"
					}
					await chatDB.conversations.add(conversation);
					console.log("Successfully created conversation:", activeConversation);
					if (isConnected) {
						syncConversation(conversation)
					}
				}
			} catch (error) {
				if (!cancelled) {
					console.error("Error details:", error);
				}
			}
		}

		createConversation();

		return () => {
			cancelled = true;
		};
	}, [activeConversation, syncConversation, isConnected])

*/}

	return (
		<div className="flex-1 flex flex-col">
			{/* Header */}
			<div className="bg-white border-b border-gray-200 px-2 h-[60px] flex items-center justify-between">
				{isConnected ? "Connected" : "Disconnected"}
			</div>


		</div>

	)
}
