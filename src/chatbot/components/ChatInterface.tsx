import { useCallback, useEffect, useRef, useState } from "react";
import chatDB from "../local/chat-db";
import { LocalMessage } from "../types/chat.type";
import { generateAIResponse } from "../lib/generateAIResponse";

interface Props {
	activeConversation: string | null;
	updateConversationTitle: (title: string) => void;
}

export default function ChatInterface({ activeConversation, updateConversationTitle }: Props) {
	const [inputValue, setInputValue] = useState<string>('');
	const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [localMessages.length, scrollToBottom]);

	useEffect(() => {
		if (activeConversation) {
			loadMessages(activeConversation);
		}
	}, [activeConversation]);


	const loadMessages = useCallback(async (conversationId: string) => {
		console.log("@@LOADING MESSAGES WITH:", conversationId)
		try {
			const conversation = await chatDB.conversations.get(conversationId);
			if (conversation?.messages) {
				setLocalMessages([...conversation.messages]);
			} else {
				setLocalMessages([]);
			}
		} catch (error) {
			console.error('Failed to load messages:', error);
			setLocalMessages([]);
		}
	}, []);

	const updateConversationInDB = useCallback(async (
		conversationId: string,
		newMessages: LocalMessage[],
		newTitle?: string
	) => {
		try {

			// Update locally in IndexedDB
			await chatDB.conversations
				.where('id')
				.equals(conversationId)
				.modify(conversation => {
					conversation.messages = [...conversation.messages, ...newMessages];
					if (newTitle) conversation.title = newTitle;
					conversation.syncStatus = "pending"; // Keep as local
				});
		} catch (error) {
			console.error('Failed to update local conversation:', error);
			// Could implement retry logic or queue for later
		}
	}, []);

	const handleSendMessage = useCallback(async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedInput = inputValue.trim();
		if (!trimmedInput || isProcessing || !activeConversation) return;

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
		setInputValue('');

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

		// Update conversation title if it's the first message
		const newTitle = trimmedInput.length > 30
			? `${trimmedInput.substring(0, 30)}...`
			: trimmedInput;

		// Update local state
		updateConversationTitle(newTitle)
		// Update database in background
		await updateConversationInDB(
			activeConversation,
			[userMessage, aiMessage],
			newTitle
		);

		setIsProcessing(false);

		// Refocus input for continuous typing
		setTimeout(() => inputRef.current?.focus(), 0);
	}, [inputValue, isProcessing, activeConversation, generateAIResponse, updateConversationInDB]);

	const activeConversationTitle = localMessages[0] ? localMessages[0].text : "No Title"

	return (
		<div className="flex-1 flex flex-col">
			{/* Header */}
			<div className="bg-white border-b border-gray-200 px-6 py-3">
				<h2 className="text-lg font-semibold text-gray-800 truncate">
					{activeConversationTitle}
				</h2>
			</div>

			{/* Messages */}
			<div className="flex-1 p-6 overflow-y-auto bg-gray-50 scroll-smooth">
				{localMessages.length === 0 ? (
					<div className="text-center mt-12 text-gray-500">
						<div className="bg-white rounded-lg p-8 shadow-sm max-w-md mx-auto">
							<h3 className="text-xl font-semibold mb-2 text-gray-700">
								Start a new conversation
							</h3>
							<p className="text-gray-600">
								Ask me anything and I'll respond instantly!
							</p>
						</div>
					</div>
				) : (
					localMessages.map((message) => (
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
						</div>
					))
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Message Input */}
			<div className="p-4 border-t border-gray-200 bg-white">
				<form onSubmit={handleSendMessage} className="flex gap-3">
					<input
						ref={inputRef}
						type="text"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						placeholder="Type your message..."
						disabled={isProcessing}
						className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
						autoFocus
					/>
					<button
						type="submit"
						disabled={!inputValue.trim() || isProcessing}
						className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 font-medium shadow-sm"
					>
						{isProcessing ? '...' : 'Send'}
					</button>
				</form>
			</div>
		</div>

	)
}
