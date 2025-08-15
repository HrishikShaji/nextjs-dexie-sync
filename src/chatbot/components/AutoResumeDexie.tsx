"use client"
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader, Trash2 } from 'lucide-react';
import chatDB from '../local/chat-db';
import ConnectionStatus from './ConnectionStatus';
import StreamingChatMessages from './StreamingChatMessages';
import ChatInput from './ChatInput';
import { LocalConversation, LocalMessage } from '../types/chat.type';

const AutoResumeDexie = () => {
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



	// Save to Dexie when state changes
	const saveToDexie = async (sessionId: string, chunkIndex: number, currentMessages: LocalMessage[], streamingContent = '') => {
		try {
			let messagesToSave = [...currentMessages];

			// If there's streaming content, handle it
			if (streamingContent) {
				if (messagesToSave.length > 0 && messagesToSave[messagesToSave.length - 1].sender === 'ai') {
					// Append to existing assistant message
					messagesToSave[messagesToSave.length - 1] = {
						...messagesToSave[messagesToSave.length - 1],
						text: messagesToSave[messagesToSave.length - 1].text + streamingContent
					};
				} else {
					// Create new assistant message
					messagesToSave.push({ sender: 'ai', text: streamingContent, syncStatus: "pending", id: crypto.randomUUID() });
				}
			}

			if (sessionId && messagesToSave.length > 0) {
				const conversation: LocalConversation = {
					id: CONVERSATION_ID,
					title: 'Resumable Chat Session',
					initialPrompt: messagesToSave[0]?.text || '',
					messages: messagesToSave,
					syncStatus: 'synced',
					localCreatedAt: new Date(),
					// Store session metadata in a custom field
					sessionMetadata: {
						sessionId,
						chunkIndex,
						hasStreamingContent: !!streamingContent
					}
				};

				await chatDB.conversations.put(conversation);
			}
		} catch (error) {
			console.error('Failed to save to Dexie:', error);
		}
	};

	// Load from Dexie and return whether there's a resumable session
	const loadFromDexie = async () => {
		try {
			const conversation = await chatDB.conversations.get(CONVERSATION_ID);

			if (conversation && conversation.sessionMetadata) {
				const { sessionId, chunkIndex, hasStreamingContent } = conversation.sessionMetadata;

				console.log(`Found session in Dexie: ${sessionId}, chunk: ${chunkIndex}`);

				// Restore messages
				if (conversation.messages && conversation.messages.length > 0) {
					const restoredMessages = conversation.messages;
					setMessages(restoredMessages);
					console.log('Restored messages:', restoredMessages);
				}

				setCurrentSession(sessionId);
				setLastChunkIndex(chunkIndex);
				return { hasSession: true, sessionId, chunkIndex };
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
			if (currentSession) {
				await saveToDexie(currentSession, lastChunkIndex, messages, '');
			} else if (!isStreaming && messages.length > 0) {
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
					connectToStream(sessionInfo.sessionId, sessionInfo.chunkIndex);
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

	const connectToStream = (sessionId: string, fromIndex = 0) => {
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

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				console.log('Received data:', data);

				if (data.type === 'content') {
					// Append chunk directly to the current assistant message
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
					connectToStream(currentSession, lastChunkIndex);
				} else {
					setStatus('disconnected');
				}
			}, 3000); // Retry after 3 seconds
		};
	};

	const sendMessage = async (input: string) => {
		if (!input.trim() || isStreaming) return;

		const userMessage: LocalMessage = { sender: "user", text: input, id: crypto.randomUUID(), syncStatus: "pending" };
		const newMessages = [...messages, userMessage];
		setMessages(newMessages);
		const messageText = input;

		setIsStreaming(true);
		setLastChunkIndex(0);
		setStatus('starting');

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

			setCurrentSession(sessionId);
			connectToStream(sessionId, 0);

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


	const getStatusInfo = () => {
		switch (status) {
			case 'ready': return { color: 'bg-gray-400', text: 'Ready' };
			case 'starting': return { color: 'bg-yellow-400 animate-pulse', text: 'Starting...' };
			case 'connecting': return { color: 'bg-blue-400 animate-pulse', text: 'Connecting...' };
			case 'streaming': return { color: 'bg-green-400 animate-pulse', text: 'Streaming' };
			case 'reconnecting': return { color: 'bg-orange-400 animate-pulse', text: 'Reconnecting...' };
			case 'disconnected': return { color: 'bg-red-400', text: 'Disconnected' };
			default: return { color: 'bg-gray-400', text: 'Ready' };
		}
	};

	const statusInfo = getStatusInfo();

	return (
		<div className="flex-1 flex flex-col">
			<div className="bg-white border-b border-gray-200 px-2 h-[60px] flex items-center justify-between">
				<ConnectionStatus
					lastChunkIndex={lastChunkIndex}
					messages={messages}
					clearChat={clearChat}
					statusInfo={statusInfo}
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

export default AutoResumeDexie;
