import { useEffect, useState } from "react";
import { LocalMessage } from "../types/chat.type";
import { generateAIResponse } from "../lib/generateAIResponse";
import { addMessagesToLocalDB } from "../lib/addMessagesToLocalDB";
import chatDB from "../local/chat-db";

interface Props {
	activeConversation: string;
	inititalUserInput: string | null;
	onMessages: (messages: LocalMessage[]) => void;
}

export default function useLoadMessages({ inititalUserInput, activeConversation, onMessages }: Props) {
	const [isLoading, setIsLoading] = useState(false)
	const [isInitialLoaded, setIsInitialLoaded] = useState(false)

	async function forFirstMessage(userMessage: string) {
		if (!activeConversation) return;
		console.log("@@RAN FIRST MESSAGE")
		setIsLoading(true);

		// Generate IDs upfront
		const aiMessageId = crypto.randomUUID();


		// Generate AI response (instant for demo)

		const aiResponseText = await generateAIResponse();
		const aiMessage: LocalMessage = {
			id: aiMessageId,
			text: aiResponseText,
			sender: 'ai',
			syncStatus: "pending", // Mark as local-only
		};

		// Add AI message to UI immediately for ultra-fast feel
		onMessages([aiMessage])
		//setLocalMessages(prev => [...prev, aiMessage]);

		// Update local state
		// Update database in background
		await addMessagesToLocalDB(
			activeConversation,
			[aiMessage],
		);

		setIsLoading(false);


	}

	useEffect(() => {
		if (inititalUserInput && !isInitialLoaded) {
			forFirstMessage(inititalUserInput)
			setIsInitialLoaded(true)
		} else {
			loadMessages(activeConversation);

		}
	}, [inititalUserInput, activeConversation, isInitialLoaded])




	const loadMessages = async (conversationId: string) => {
		console.log("@@LOADING MESSAGES WITH:", conversationId)
		try {
			const conversation = await chatDB.conversations.get(conversationId);
			if (conversation?.messages) {
				onMessages([...conversation.messages])
			} else {
				onMessages([])
			}
		} catch (error) {
			console.error('Failed to load messages:', error);
			onMessages([])
		}
	};

	return { isLoading }

}
