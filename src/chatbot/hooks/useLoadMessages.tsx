import { useEffect, useState } from "react";
import { LocalMessage } from "../types/chat.type";
import { generateAIResponse } from "../lib/generateAIResponse";
import { addMessagesToLocalDB } from "../lib/addMessagesToLocalDB";

interface Props {
	activeConversation: string;
	inititalUserInput: string | null;
}

export default function useLoadMessages({ inititalUserInput, activeConversation }: Props) {
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
		}
	}, [inititalUserInput, activeConversation, isInitialLoaded])





	return { isLoading }

}
