"use client"
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Conversation, LocalConversation, LocalMessage, Message } from '../types/chat.type';
import chatDB from '../local/chat-db';
import ConversationCard from './ConversationCard';
import { generateAIResponse } from '../lib/generateAIResponse';

export default function Chatbot() {
	const [inputValue, setInputValue] = useState<string>('');
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [activeConversation, setActiveConversation] = useState<string | null>(null);
	const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);


	// Optimized scroll - only when needed
	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [localMessages.length, scrollToBottom]);

	// Load conversations on mount
	useEffect(() => {
		loadConversations();
	}, []);

	// Load messages when active conversation changes
	useEffect(() => {
		if (activeConversation) {
			loadMessages(activeConversation);
		}
	}, [activeConversation]);

	const loadConversations = useCallback(async () => {
		try {
			// Load all conversations from IndexedDB - fully local
			const localConversations = await chatDB.conversations.orderBy('id').reverse().toArray();
			const mappedConversations: Conversation[] = localConversations.map(conv => ({
				id: conv.id,
				title: conv.title,
				messages: conv.messages.map(msg => ({
					id: msg.id,
					text: msg.text,
					sender: msg.sender
				})),
			}));

			setConversations(mappedConversations);

			// Set active conversation if none exists
			if (!activeConversation && mappedConversations.length > 0) {
				setActiveConversation(mappedConversations[0].id);
			} else if (mappedConversations.length === 0) {
				createNewConversation();
			}
		} catch (error) {
			console.error('Failed to load conversations from local storage:', error);
			// Create a new conversation as fallback
			createNewConversation();
		}
	}, [activeConversation]);

	const loadMessages = useCallback(async (conversationId: string) => {
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

	const createNewConversation = useCallback(async () => {
		const id = crypto.randomUUID();
		const title = `New Chat ${Date.now()}`;

		const newConversation: Conversation = {
			id,
			title,
			messages: [],
		};

		// Store completely locally in IndexedDB
		const localConversation: LocalConversation = {
			id,
			title,
			syncStatus: "pending", // Mark as local-only
			messages: [],
		};

		try {
			// Save to local IndexedDB first
			await chatDB.conversations.add(localConversation);

			// Update local state
			setConversations(prev => [newConversation, ...prev]);
			setActiveConversation(id);
			setLocalMessages([]);

			// Focus input after creating new conversation
			setTimeout(() => inputRef.current?.focus(), 0);
		} catch (error) {
			console.error('Failed to create local conversation:', error);
			// Still update UI even if DB fails
			setConversations(prev => [newConversation, ...prev]);
			setActiveConversation(id);
			setLocalMessages([]);
		}
	}, []);

	const switchConversation = useCallback((conversationId: string) => {
		if (conversationId === activeConversation) return;
		setActiveConversation(conversationId);
	}, [activeConversation]);


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
		setConversations(prev =>
			prev.map(conv =>
				conv.id === activeConversation
					? {
						...conv,
						title: newTitle,
						messages: [...conv.messages,
						{ id: userMessageId, text: trimmedInput, sender: 'user' },
						{ id: aiMessageId, text: aiResponseText, sender: 'ai' }
						]
					}
					: conv
			)
		);

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

	const deleteConversation = useCallback(async (conversationId: string) => {

		try {
			// Delete from local IndexedDB
			await chatDB.conversations.delete(conversationId);

			// Update local state
			const updatedConversations = conversations.filter(c => c.id !== conversationId);
			setConversations(updatedConversations);

			if (activeConversation === conversationId) {
				if (updatedConversations.length > 0) {
					setActiveConversation(updatedConversations[0].id);
				} else {
					await createNewConversation();
				}
			}
		} catch (error) {
			console.error('Failed to delete local conversation:', error);
			// Still update UI even if delete fails
			const updatedConversations = conversations.filter(c => c.id !== conversationId);
			setConversations(updatedConversations);

			if (activeConversation === conversationId && updatedConversations.length > 0) {
				setActiveConversation(updatedConversations[0].id);
			}
		}
	}, [conversations, activeConversation, createNewConversation]);


	const activeConversationTitle = useMemo(() => {
		return conversations.find(c => c.id === activeConversation)?.title || 'New Chat';
	}, [conversations, activeConversation]);

	return (
		<div className="flex h-full bg-gray-50">
			{/* Sidebar */}
			<div className="w-64 bg-white border-r border-gray-200 flex flex-col">
				<div className="p-2 border-b border-gray-100">
					<button
						onClick={createNewConversation}
						className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors duration-150 shadow-sm"
						title="New Chat (Ctrl+N)"
					>
						+ New Chat
					</button>
				</div>

				<div className="flex-1 overflow-y-auto">
					{conversations.map((conversation) => (
						<ConversationCard
							key={conversation.id}
							conversation={conversation as LocalConversation}
							activeConversation={activeConversation}
							switchConversation={switchConversation}
							deleteConversation={deleteConversation}
						/>
					))}

					{conversations.length === 0 && (
						<div className="p-4 text-center text-gray-500 text-sm">
							No conversations yet.<br />
							Create your first chat!
						</div>
					)}
				</div>

				<div className="p-2 border-t border-gray-100 text-xs text-gray-400 text-center">
					{conversations.length} conversation{conversations.length !== 1 ? 's' : ''} stored locally
				</div>
			</div>

			{/* Chat Window */}
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
		</div>
	);
}
