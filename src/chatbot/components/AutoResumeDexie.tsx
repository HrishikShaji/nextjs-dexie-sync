"use client"
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader, Trash2 } from 'lucide-react';
import chatDB from '../local/chat-db';

const AutoResumeDexie = () => {
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState('');
	const [isStreaming, setIsStreaming] = useState(false);
	const [currentSession, setCurrentSession] = useState(null);
	const [lastChunkIndex, setLastChunkIndex] = useState(0);
	const [status, setStatus] = useState('ready');
	const messagesEndRef = useRef(null);
	const eventSourceRef = useRef(null);
	const hasAutoResumed = useRef(false);

	// Conversation ID for Dexie storage (equivalent to session storage)
	const CONVERSATION_ID = 'resumable_chat_session';

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	// Convert messages format for storage
	const convertMessagesToLocalFormat = (messages) => {
		return messages.map((msg, index) => ({
			id: `msg_${index}_${Date.now()}`,
			text: msg.content,
			sender: msg.role === 'user' ? 'user' : 'ai',
			syncStatus: 'synced'
		}));
	};

	// Convert from storage format back to component format
	const convertFromLocalFormat = (localMessages) => {
		return localMessages.map(msg => ({
			role: msg.sender === 'user' ? 'user' : 'assistant',
			content: msg.text
		}));
	};

	// Save to Dexie when state changes
	const saveToDexie = async (sessionId, chunkIndex, currentMessages, streamingContent = '') => {
		try {
			let messagesToSave = [...currentMessages];

			// If there's streaming content, handle it
			if (streamingContent) {
				if (messagesToSave.length > 0 && messagesToSave[messagesToSave.length - 1].role === 'assistant') {
					// Append to existing assistant message
					messagesToSave[messagesToSave.length - 1] = {
						...messagesToSave[messagesToSave.length - 1],
						content: messagesToSave[messagesToSave.length - 1].content + streamingContent
					};
				} else {
					// Create new assistant message
					messagesToSave.push({ role: 'assistant', content: streamingContent });
				}
			}

			if (sessionId && messagesToSave.length > 0) {
				const conversation = {
					id: CONVERSATION_ID,
					title: 'Resumable Chat Session',
					initialPrompt: messagesToSave[0]?.content || '',
					messages: convertMessagesToLocalFormat(messagesToSave),
					syncStatus: 'synced',
					localCreatedAt: new Date(),
					// Store session metadata in a custom field
					_sessionMetadata: {
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

			if (conversation && conversation._sessionMetadata) {
				const { sessionId, chunkIndex, hasStreamingContent } = conversation._sessionMetadata;

				console.log(`Found session in Dexie: ${sessionId}, chunk: ${chunkIndex}`);

				// Restore messages
				if (conversation.messages && conversation.messages.length > 0) {
					const restoredMessages = convertFromLocalFormat(conversation.messages);
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
					const conversation = await chatDB.conversations.get(CONVERSATION_ID);
					if (conversation) {
						// Remove session metadata but keep messages
						delete conversation._sessionMetadata;
						await chatDB.conversations.put(conversation);
					}
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

	const connectToStream = (sessionId, fromIndex = 0) => {
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
						if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
							// Append to existing assistant message
							newMessages[newMessages.length - 1] = {
								...newMessages[newMessages.length - 1],
								content: newMessages[newMessages.length - 1].content + data.content
							};
						} else {
							// Create new assistant message
							newMessages.push({ role: 'assistant', content: data.content });
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
						role: 'assistant',
						content: 'Sorry, there was an error processing your request.'
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

	const sendMessage = async () => {
		if (!input.trim() || isStreaming) return;

		const userMessage = { role: 'user', content: input };
		const newMessages = [...messages, userMessage];
		setMessages(newMessages);
		const messageText = input;
		setInput('');

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

		} catch (error) {
			console.error('Error starting chat:', error);
			setMessages(prev => [...prev, {
				role: 'assistant',
				content: `Error: ${error.message}`
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

	const handleKeyPress = (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
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
		<div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
			{/* Header */}
			<div className="bg-black/20 backdrop-blur-sm border-b border-purple-500/20 p-4">
				<div className="max-w-4xl mx-auto flex items-center gap-3">
					<div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
						<Bot className="w-5 h-5 text-white" />
					</div>
					<h1 className="text-xl font-semibold text-white">Auto-Resume Streaming Chat</h1>
					<div className="ml-auto flex items-center gap-4">
						{messages.length > 0 && (
							<button
								onClick={clearChat}
								className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2"
							>
								<Trash2 className="w-4 h-4" />
								Clear Chat
							</button>
						)}
						{currentSession && (
							<div className="text-xs text-gray-400 font-mono">
								{currentSession.slice(0, 8)}... (chunk: {lastChunkIndex})
							</div>
						)}
						<div className="flex items-center gap-2">
							<div className={`w-2 h-2 rounded-full ${statusInfo.color}`}></div>
							<span className="text-sm text-gray-300">{statusInfo.text}</span>
						</div>
					</div>
				</div>
			</div>

			{/* Auto-Resume Notification */}
			{status === 'connecting' && currentSession && (
				<div className="bg-blue-500/20 border-b border-blue-500/30 p-3">
					<div className="max-w-4xl mx-auto flex items-center gap-3">
						<Loader className="w-5 h-5 text-blue-400 animate-spin" />
						<div className="flex-1 text-blue-300">
							<strong>Resuming stream...</strong> Automatically continuing from where you left off.
						</div>
					</div>
				</div>
			)}

			{/* Reconnecting Notification */}
			{status === 'reconnecting' && (
				<div className="bg-orange-500/20 border-b border-orange-500/30 p-3">
					<div className="max-w-4xl mx-auto flex items-center gap-3">
						<Loader className="w-5 h-5 text-orange-400 animate-spin" />
						<div className="flex-1 text-orange-300">
							<strong>Connection lost!</strong> Automatically retrying in a few seconds...
						</div>
					</div>
				</div>
			)}

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-4">
				<div className="max-w-4xl mx-auto space-y-6">
					{messages.map((message, index) => (
						<div key={index} className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
							{message.role === 'assistant' && (
								<div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
									<Bot className="w-5 h-5 text-white" />
								</div>
							)}

							<div className={`max-w-3xl rounded-2xl p-4 ${message.role === 'user'
								? 'bg-blue-600 text-white ml-12'
								: 'bg-gray-800/50 backdrop-blur-sm text-gray-100 border border-gray-700/50'
								}`}>
								<div className="whitespace-pre-wrap break-words">{message.content}</div>
							</div>

							{message.role === 'user' && (
								<div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
									<User className="w-5 h-5 text-white" />
								</div>
							)}
						</div>
					))}

					{/* Loading indicator when streaming but no content yet */}
					{isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
						<div className="flex gap-4 justify-start">
							<div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
								<Loader className="w-5 h-5 text-white animate-spin" />
							</div>
							<div className="max-w-3xl rounded-2xl p-4 bg-gray-800/50 backdrop-blur-sm text-gray-100 border border-gray-700/50">
								<div className="flex items-center gap-2">
									<div className="flex gap-1">
										<div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
										<div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
										<div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
									</div>
									<span className="text-sm text-gray-400">{statusInfo.text}</span>
								</div>
							</div>
						</div>
					)}

					<div ref={messagesEndRef} />
				</div>
			</div>

			{/* Input */}
			<div className="bg-black/20 backdrop-blur-sm border-t border-purple-500/20 p-4">
				<div className="max-w-4xl mx-auto">
					<div className="flex gap-4 items-end">
						<div className="flex-1 relative">
							<textarea
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyPress={handleKeyPress}
								placeholder="Type your message... (Streams automatically resume on page reload!)"
								className="w-full bg-gray-800/50 backdrop-blur-sm border border-gray-600/50 rounded-2xl px-4 py-3 text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
								rows="1"
								style={{ minHeight: '52px', maxHeight: '120px' }}
								disabled={isStreaming}
							/>
						</div>
						<button
							onClick={sendMessage}
							disabled={!input.trim() || isStreaming}
							className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white p-3 rounded-full transition-all duration-200 flex items-center justify-center"
						>
							{isStreaming ? (
								<Loader className="w-5 h-5 animate-spin" />
							) : (
								<Send className="w-5 h-5" />
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default AutoResumeDexie;
