"use client"
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader, RefreshCw, Play, Trash2 } from 'lucide-react';

const WorkingResumableChat = () => {
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState('');
	const [isStreaming, setIsStreaming] = useState(false);
	const [currentSession, setCurrentSession] = useState(null);
	const [lastChunkIndex, setLastChunkIndex] = useState(0);
	const [status, setStatus] = useState('ready');
	const [showResumeButton, setShowResumeButton] = useState(false);
	const messagesEndRef = useRef(null);
	const eventSourceRef = useRef(null);

	// LocalStorage keys
	const STORAGE_KEYS = {
		SESSION_ID: 'resumable_chat_session_id',
		CHUNK_INDEX: 'resumable_chat_chunk_index',
		MESSAGES: 'resumable_chat_messages',
		STREAMING_CONTENT: 'resumable_chat_streaming_content'
	};

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	// Save to localStorage when state changes
	const saveToLocalStorage = (sessionId, chunkIndex, currentMessages, streamingContent = '') => {
		try {
			if (sessionId) {
				localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
				localStorage.setItem(STORAGE_KEYS.CHUNK_INDEX, chunkIndex.toString());
			}

			if (currentMessages && currentMessages.length > 0) {
				localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(currentMessages));
			}

			if (streamingContent) {
				localStorage.setItem(STORAGE_KEYS.STREAMING_CONTENT, streamingContent);
			} else {
				localStorage.removeItem(STORAGE_KEYS.STREAMING_CONTENT);
			}
		} catch (error) {
			console.error('Failed to save to localStorage:', error);
		}
	};

	// Load from localStorage
	const loadFromLocalStorage = () => {
		try {
			const sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
			const chunkIndex = parseInt(localStorage.getItem(STORAGE_KEYS.CHUNK_INDEX) || '0');
			const messagesData = localStorage.getItem(STORAGE_KEYS.MESSAGES);
			const streamingData = localStorage.getItem(STORAGE_KEYS.STREAMING_CONTENT);

			if (sessionId) {
				console.log(`Found session in localStorage: ${sessionId}, chunk: ${chunkIndex}`);

				// Restore messages
				if (messagesData) {
					const decodedMessages = JSON.parse(messagesData);
					let restoredMessages = [...decodedMessages];

					// If there's streaming content, append it to the last assistant message or create a new one
					if (streamingData) {
						console.log('Restored streaming content:', streamingData);

						// Check if the last message is an assistant message
						if (restoredMessages.length > 0 && restoredMessages[restoredMessages.length - 1].role === 'assistant') {
							// Append to existing assistant message
							restoredMessages[restoredMessages.length - 1].content += streamingData;
						} else {
							// Create new assistant message
							restoredMessages.push({ role: 'assistant', content: streamingData });
						}
					}

					setMessages(restoredMessages);
					console.log('Restored messages:', restoredMessages);
				} else if (streamingData) {
					// Only streaming data, no messages yet
					setMessages([{ role: 'assistant', content: streamingData }]);
					console.log('Restored streaming-only content:', streamingData);
				}

				setCurrentSession(sessionId);
				setLastChunkIndex(chunkIndex);
				setShowResumeButton(true);
				return true;
			}
		} catch (error) {
			console.error('Failed to load from localStorage:', error);
		}
		return false;
	};

	// Clear localStorage
	const clearLocalStorage = () => {
		try {
			Object.values(STORAGE_KEYS).forEach(key => {
				localStorage.removeItem(key);
			});
		} catch (error) {
			console.error('Failed to clear localStorage:', error);
		}
	};

	// Update localStorage when state changes
	useEffect(() => {
		if (currentSession) {
			saveToLocalStorage(currentSession, lastChunkIndex, messages, '');
		} else if (!isStreaming && messages.length > 0) {
			// Clear session data when complete, but keep messages for display
			localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
			localStorage.removeItem(STORAGE_KEYS.CHUNK_INDEX);
			localStorage.removeItem(STORAGE_KEYS.STREAMING_CONTENT);
		}
	}, [currentSession, lastChunkIndex, messages, isStreaming]);

	// Load session on mount
	useEffect(() => {
		loadFromLocalStorage();
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
		setShowResumeButton(false);
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
					setShowResumeButton(false);
					eventSource.close();
				}
			} catch (error) {
				console.error('Parse error:', error);
			}
		};

		eventSource.onerror = (error) => {
			console.error('EventSource error:', error);
			setStatus('reconnecting');
			setShowResumeButton(true);

			// Don't auto-reconnect, let user manually resume
			setTimeout(() => {
				if (eventSourceRef.current) {
					eventSourceRef.current.close();
				}
				setStatus('disconnected');
			}, 2000);
		};
	};

	const resumeStream = () => {
		if (currentSession) {
			console.log(`Resuming stream: ${currentSession} from chunk: ${lastChunkIndex}`);
			connectToStream(currentSession, lastChunkIndex);
		}
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

	const clearChat = () => {
		setMessages([]);
		setCurrentSession(null);
		setLastChunkIndex(0);
		setShowResumeButton(false);
		clearLocalStorage();
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
					<h1 className="text-xl font-semibold text-white">LocalStorage Resumable Chat</h1>
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
						{showResumeButton && (
							<button
								onClick={resumeStream}
								className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2"
							>
								<Play className="w-4 h-4" />
								Resume Stream
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

			{/* Resume Banner */}
			{showResumeButton && (
				<div className="bg-green-500/20 border-b border-green-500/30 p-3">
					<div className="max-w-4xl mx-auto flex items-center gap-3">
						<RefreshCw className="w-5 h-5 text-green-400" />
						<div className="flex-1 text-green-300">
							<strong>Stream interrupted!</strong> Click "Resume Stream" to continue where you left off.
						</div>
						<button
							onClick={resumeStream}
							className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
						>
							<Play className="w-4 h-4" />
							Resume Now
						</button>
					</div>
				</div>
			)}

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-4">
				<div className="max-w-4xl mx-auto space-y-6">
					{messages.length === 0 && (
						<div className="text-center py-12">
							<div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
								<Bot className="w-8 h-8 text-white" />
							</div>
							<h2 className="text-2xl font-bold text-white mb-2">LocalStorage Resumable Chat</h2>
							<p className="text-gray-400 mb-4">State is saved in localStorage - automatically resumes on page refresh!</p>
							<div className="text-sm text-gray-500 space-y-1 bg-gray-800/30 rounded-lg p-4">
								<p>💡 <strong>Test Instructions:</strong></p>
								<p>1. Ask: "Write me a very long 1000-word story about dragons"</p>
								<p>2. Refresh the page while it's streaming</p>
								<p>3. Click "Resume Stream" to continue!</p>
								<p>4. Use "Clear Chat" to reset everything</p>
							</div>
						</div>
					)}

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

					{/* Loading indicator when no streaming content yet */}
					{isStreaming && (
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
								placeholder="Type your message... (State is saved in localStorage for easy resuming!)"
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

export default WorkingResumableChat;
