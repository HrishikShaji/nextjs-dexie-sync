"use client"
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader, Trash2 } from 'lucide-react';
import chatDB from '../local/chat-db';
import ConnectionStatus from './ConnectionStatus';
import StreamingChatMessages from './StreamingChatMessages';
import ChatInput from './ChatInput';
import { LocalConversation, LocalMessage } from '../types/chat.type';

async function saveUserMessage({ conversationId, message }: { conversationId: string; message: LocalMessage; }) {
	try {
		const savedMessage = await chatDB.conversations.where("id").equals(conversationId).modify((conversation) => {
			conversation.messages = [...conversation.messages, message]
		})
		console.log(savedMessage)
	} catch (err) {
		console.log("Error saving message", err)
	}
}

async function createConversation({ conversationId, message }: { conversationId: string; message: LocalMessage }) {
	try {
		const conversation: LocalConversation = {
			id: conversationId,
			title: message.text,
			initialPrompt: message.text,
			syncStatus: "pending",
			messages: [message]
		}
		const savedConversation = await chatDB.conversations.add(conversation)
		console.log(savedConversation)
	} catch (err) {
		console.log('Error saving conversation', err)
	}
}

async function saveAssistantMessage({
	conversationId,
	message,
	chunkIndex,
	sessionId,
	hasStreamingContent
}: {
	conversationId: string;
	message: LocalMessage;
	chunkIndex: number;
	sessionId: string;
	hasStreamingContent: boolean
}) {

	try {
		const savedMessage = await chatDB.conversations.where("id").equals(conversationId).modify((conversation) => {
			conversation.messages = [...conversation.messages, message],
				conversation.sessionMetadata = {
					hasStreamingContent,
					sessionId,
					chunkIndex,
					lastMessageId: message.id
				}
		})
		console.log(savedMessage)
	} catch (err) {
		console.log("Error saving Message", err)
	}
}

async function updateAssistantMessage({
	text,
	messageId,
	chunkIndex,
	conversationId,
	hasStreamingContent,
	sessionId
}: {
	text: string;
	messageId: string;
	conversationId: string;
	chunkIndex: number;
	sessionId: string;
	hasStreamingContent: boolean
}) {
	await chatDB.conversations.where("id").equals(conversationId).modify((conversation) => {
		conversation.messages = conversation.messages.map((message) => {
			if (message.id === messageId) {
				return {
					...message,
					text: message.text + text
				}
			}
			return message
		});
		conversation.sessionMetadata = {
			chunkIndex,
			sessionId,
			hasStreamingContent,
			lastMessageId: messageId
		}
	})
}

const NewAutoResume = () => {
	const [messages, setMessages] = useState<LocalMessage[]>([]);
	const [isStreaming, setIsStreaming] = useState(false);
	const [currentSession, setCurrentSession] = useState<string | null>(null);
	const [lastChunkIndex, setLastChunkIndex] = useState(0);
	const [status, setStatus] = useState('ready');
	const [streamingMessageId, setStreamingMessageId] = useState(null)
	const eventSourceRef = useRef<EventSource>(null);
	const hasAutoResumed = useRef(false);

	// Conversation ID for Dexie storage (equivalent to session storage)
	const CONVERSATION_ID = 'resumable_chat_session';
	// Load from Dexie and return whether there's a resumable session
	const loadFromDexie = async () => {
		try {
			const conversation = await chatDB.conversations.get(CONVERSATION_ID);
			console.log("@@Conversation", conversation)
			if (conversation && conversation.sessionMetadata) {
				const { sessionId, chunkIndex, hasStreamingContent, lastMessageId } = conversation.sessionMetadata;

				console.log(`Found session in Dexie: ${sessionId}, chunk: ${chunkIndex}`);

				// Restore messages
				if (conversation.messages && conversation.messages.length > 0) {
					const restoredMessages = conversation.messages;
					setMessages(restoredMessages);
					console.log('Restored messages:', restoredMessages);
				}

				setCurrentSession(sessionId);
				setLastChunkIndex(chunkIndex);
				return { hasSession: true, sessionId, chunkIndex, lastMessageId };
			}
		} catch (error) {
			console.error('Failed to load from Dexie:', error);
		}
		return { hasSession: false };
	};

	// Clear Dexie storage
	const clearDexie = async () => {
		try {
			await chatDB.conversations.delete(CONVERSATION_ID);
		} catch (error) {
			console.error('Failed to clear Dexie:', error);
		}
	};

	// Update Dexie when state changes
	useEffect(() => {
		const updateStorage = async () => {
			if (!isStreaming && messages.length > 0) {
				// Clear session data when complete, but keep messages for display
				try {
					await chatDB.conversations.where("id").equals(CONVERSATION_ID).modify((conversation) => {
						const { sessionMetadata, ...newConversation } = conversation
						conversation = newConversation
					})
				} catch (error) {
					console.error('Failed to update conversation:', error);
				}
			}
		};

		updateStorage();
	}, [currentSession, lastChunkIndex, messages, isStreaming]);

	// Load session on mount and auto-resume if needed
	useEffect(() => {
		const initializeSession = async () => {
			const sessionInfo = await loadFromDexie();

			// Auto-resume if there's a session and we haven't already resumed
			if (sessionInfo.hasSession && !hasAutoResumed.current) {
				hasAutoResumed.current = true;
				console.log('Auto-resuming stream...');
				// Small delay to ensure UI has updated
				setTimeout(() => {
					if (!sessionInfo.sessionId) return
					connectToStream(sessionInfo.sessionId, sessionInfo.chunkIndex, sessionInfo.lastMessageId);
				}, 100);
			}
		};

		initializeSession();
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}
		};
	}, []);

	console.log(messages)

	const connectToStream = (sessionId: string, fromIndex = 0, messageId: string) => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
		}

		setStatus('connecting');
		const url = `http://localhost:3001/api/chat/stream?sessionId=${sessionId}&lastChunkIndex=${fromIndex}`;
		console.log(`Connecting to: ${url}`);

		const eventSource = new EventSource(url);
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			console.log('Connected to stream');
			setStatus('streaming');
			setIsStreaming(true);
		};

		eventSource.onmessage = async (event) => {
			try {
				const data = JSON.parse(event.data);
				console.log('Received data:', data);

				if (data.type === 'content') {
					// Append chunk directly to the current assistant message
					await updateAssistantMessage({
						conversationId: CONVERSATION_ID,
						messageId,
						sessionId,
						hasStreamingContent: true,
						chunkIndex: data.chunkIndex + 1,
						text: data.content
					})
					setMessages(prev => {
						const newMessages = [...prev];
						// Check if the last message is an assistant message
						if (newMessages.length > 0 && newMessages[newMessages.length - 1].sender === 'ai') {
							// Append to existing assistant message
							newMessages[newMessages.length - 1] = {
								...newMessages[newMessages.length - 1],
								text: newMessages[newMessages.length - 1].text + data.content
							};
						} else {
							// Create new assistant message
							newMessages.push({ sender: "ai", text: data.content, syncStatus: "pending", id: crypto.randomUUID() });
						}
						return newMessages;
					});
					setLastChunkIndex(data.chunkIndex + 1);
				} else if (data.type === 'done') {
					console.log('Stream completed');
					setIsStreaming(false);
					setCurrentSession(null);
					setLastChunkIndex(0);
					setStatus('ready');
					eventSource.close();
				} else if (data.type === 'error') {
					console.error('Stream error:', data.error);
					setMessages(prev => [...prev, {
						sender: 'ai',
						text: 'Sorry, there was an error processing your request.',
						syncStatus: "pending",
						id: crypto.randomUUID()
					}]);
					setIsStreaming(false);
					setCurrentSession(null);
					setLastChunkIndex(0);
					setStatus('ready');
					eventSource.close();
				}
			} catch (error) {
				console.error('Parse error:', error);
			}
		};

		eventSource.onerror = (error) => {
			console.error('EventSource error:', error);
			setStatus('reconnecting');

			// Auto-retry after a delay
			setTimeout(() => {
				if (currentSession && eventSourceRef.current) {
					console.log('Auto-retrying connection...');
					connectToStream(currentSession, lastChunkIndex, messageId);
				} else {
					setStatus('disconnected');
				}
			}, 3000); // Retry after 3 seconds
		};
	};

	const sendMessage = async (input: string) => {
		if (!input.trim() || isStreaming) return;
		const userMessage: LocalMessage = { sender: "user", text: input, id: crypto.randomUUID(), syncStatus: "pending" };
		if (messages.length === 0) {
			await createConversation({
				conversationId: CONVERSATION_ID,
				message: userMessage
			})
		} else {
			await saveUserMessage({
				conversationId: CONVERSATION_ID,
				message: userMessage
			})
		}

		const newMessages = [...messages, userMessage];
		setMessages(newMessages);
		const messageText = input;

		setIsStreaming(true);
		setLastChunkIndex(0);
		setStatus('starting');

		const assistantMessage: LocalMessage = { sender: "ai", text: "", id: crypto.randomUUID(), syncStatus: "pending" }


		try {
			console.log('Starting new chat...');
			const response = await fetch('http://localhost:3001/api/chat/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: messageText }),
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const { sessionId } = await response.json();
			console.log('Got session ID:', sessionId);
			await saveAssistantMessage({
				message: assistantMessage,
				conversationId: CONVERSATION_ID,
				hasStreamingContent: true,
				chunkIndex: 0,
				sessionId
			})

			setCurrentSession(sessionId);
			connectToStream(sessionId, 0, assistantMessage.id);

		} catch (error: any) {
			console.error('Error starting chat:', error);
			setMessages(prev => [...prev, {
				id: crypto.randomUUID(),
				sender: "ai",
				syncStatus: "pending",
				text: `Error: ${error.message}`
			}]);
			setIsStreaming(false);
			setStatus('ready');
		}
	};

	const clearChat = async () => {
		setMessages([]);
		setCurrentSession(null);
		setLastChunkIndex(0);
		await clearDexie();
		hasAutoResumed.current = false;
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
		}
		setIsStreaming(false);
		setStatus('ready');
	};



	return (
		<div className="flex-1 h-full flex flex-col">
			<div className="bg-white border-b border-gray-200 px-2 h-[60px] flex items-center justify-between">
				<ConnectionStatus
					lastChunkIndex={lastChunkIndex}
					messages={messages}
					clearChat={clearChat}
					currentSession={currentSession}
					status={status}
				/>
			</div>
			<StreamingChatMessages
				messages={messages}
				streamingMessageId={streamingMessageId}
			/>
			<ChatInput
				isProcessing={isStreaming}
				onSubmit={sendMessage}
			/>
		</div>
	);
};

export default NewAutoResume;
