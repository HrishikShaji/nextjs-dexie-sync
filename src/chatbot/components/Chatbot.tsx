"use client"
import React, { useState, useEffect, useRef } from 'react';
import { Conversation, LocalConversation, LocalMessage, Message } from '../types/chat.type';
import chatDB from '../local/chat-db';
import { delay } from '@/lib/utils';

export default function Chatbot() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [inputValue, setInputValue] = useState<string>('');
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [activeConversation, setActiveConversation] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [localMessages, setLocalMessages] = useState<LocalMessage[]>([])

	const aiResponses: string[] = [
		"I'm an AI assistant. How can I help you today?",
		"That's an interesting question. Let me think about that...",
		"Based on my knowledge, I'd suggest considering multiple perspectives.",
		"I don't have enough information to answer that fully.",
		"Could you clarify your question? I want to make sure I understand.",
		"Thanks for asking! Here's what I know about that topic...",
		"I'm designed to be helpful, harmless, and honest in my responses.",
		"That's outside my current capabilities, but I can try to point you in the right direction."
	];

	// Scroll to bottom of messages
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	useEffect(() => {
		if (activeConversation) {
			getLocalMessages(activeConversation)
		}
	}, [activeConversation])

	async function getLocalMessages(id: string) {
		const conversation = await chatDB.conversations.get(id)
		console.log(conversation?.messages)
		if (conversation?.messages) {
			setLocalMessages(conversation.messages)
		}
	}

	// Initialize with a default conversation
	useEffect(() => {
		if (conversations.length === 0) {
			createNewConversation();
		}
	}, []);


	const createNewConversation = async () => {
		const id = crypto.randomUUID()
		const newConversation: Conversation = {
			id,
			title: `New Conversation ${conversations.length + 1}`,
			messages: []
		};
		setConversations([...conversations, newConversation]);
		setActiveConversation(newConversation.id);
		setMessages([]);
		const conversationObj: LocalConversation = {
			id,
			title: `New Conversation ${conversations.length + 1}`,
			syncStatus: "pending",
			messages: []
		}

		await chatDB.conversations.add(conversationObj)
	};

	const switchConversation = (conversationId: string): void => {
		const conversation = conversations.find(c => c.id === conversationId);
		if (conversation) {
			setActiveConversation(conversationId);
			setMessages(conversation.messages);
		}
	};

	const handleSendMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!inputValue.trim()) return;

		const userMessage: Message = {
			id: crypto.randomUUID(),
			text: inputValue,
			sender: 'user'
		};

		// Update current messages
		const updatedMessages: Message[] = [...messages, userMessage];
		setMessages(updatedMessages);
		setInputValue('');

		await delay(2000)
		// Simulate AI response after a delay
		const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
		const aiMessage: Message = {
			id: crypto.randomUUID(),
			text: randomResponse,
			sender: 'ai'
		};

		const finalMessages: Message[] = [...updatedMessages, aiMessage];
		setMessages(finalMessages);

		// Update conversation in history
		const updatedConversations = conversations.map(conv => {
			if (conv.id === activeConversation) {
				return {
					...conv,
					messages: finalMessages,
					title: inputValue.length > 20 ? `${inputValue.substring(0, 20)}...` : inputValue
				};
			}
			return conv;
		});
		setConversations(updatedConversations);


		console.log("@@RANDOM", randomResponse)

		const newMessages: LocalMessage[] = [
			{
				id: crypto.randomUUID(),
				text: inputValue,
				sender: 'user',
				syncStatus: "pending"
			},
			{
				id: crypto.randomUUID(),
				text: randomResponse,
				sender: "ai",
				syncStatus: "pending"
			}
		]

		if (!activeConversation) return
		try {
			const updatedCount = await chatDB.conversations
				.where('id')
				.equals(activeConversation)
				.modify(conversation => {
					conversation.syncStatus = "synced";
					conversation.messages = [...conversation.messages, ...newMessages];
				});

			console.log("@@UPDATE RESULT", updatedCount);
		} catch (error) {
			console.error("Update error:", error);
		}
	};

	const deleteConversation = (conversationId: string, e: React.MouseEvent): void => {
		e.stopPropagation();
		const updatedConversations = conversations.filter(c => c.id !== conversationId);
		setConversations(updatedConversations);

		if (activeConversation === conversationId) {
			if (updatedConversations.length > 0) {
				switchConversation(updatedConversations[0].id);
			} else {
				createNewConversation();
			}
		}
	};

	return (
		<div className="flex h-full bg-gray-50">
			{/* Sidebar */}
			<div className="w-64 bg-white border-r border-gray-200 flex flex-col">
				<button
					onClick={createNewConversation}
					className="m-2 p-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium transition-colors"
				>
					+ New Chat
				</button>

				<div className="flex-1 overflow-y-auto">
					{conversations.map((conversation) => (
						<div
							key={conversation.id}
							className={`flex justify-between items-center p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-100 ${activeConversation === conversation.id ? 'bg-gray-200 font-medium' : ''
								}`}
							onClick={() => switchConversation(conversation.id)}
						>
							<span className="truncate flex-1">{conversation.title}</span>
							<button
								className="text-gray-500 hover:text-red-500 px-2"
								onClick={(e) => deleteConversation(conversation.id, e)}
							>
								×
							</button>
						</div>
					))}
				</div>
			</div>

			{/* Chat Window */}
			<div className="flex-1 flex flex-col">
				<div className="flex-1 p-6 overflow-y-auto bg-gray-50">
					{localMessages.length === 0 ? (
						<div className="text-center mt-12 text-gray-500">
							<h3 className="text-xl font-semibold mb-2">Start a new conversation</h3>
							<p>Ask me anything and I'll do my best to respond!</p>
						</div>
					) : (
						localMessages.map((message) => (
							<div
								key={message.id}
								className={`flex mb-4 ${message.sender === 'user' ? 'justify-end' : 'justify-start'
									}`}
							>
								<div
									className={`max-w-[70%] px-4 py-2 rounded-lg ${message.sender === 'user'
										? 'bg-green-600 text-white'
										: 'bg-gray-200 text-gray-800'
										}`}
								>
									{message.text}
								</div>
							</div>
						))
					)}
					<div ref={messagesEndRef} />
				</div>

				{/* Message Input */}
				<form
					onSubmit={handleSendMessage}
					className="p-4 border-t border-gray-200 bg-white flex"
				>
					<input
						type="text"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						placeholder="Type your message..."
						className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
					/>
					<button
						type="submit"
						className="ml-3 px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
					>
						Send
					</button>
				</form>
			</div>
		</div>
	);
};

