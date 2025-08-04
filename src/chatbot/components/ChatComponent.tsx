"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader, RefreshCw } from 'lucide-react';

const SimpleResumableChat = () => {
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState('');
	const [isStreaming, setIsStreaming] = useState(false);
	const [streamingContent, setStreamingContent] = useState('');
	const [currentSession, setCurrentSession] = useState(null);
	const [lastChunkIndex, setLastChunkIndex] = useState(0);
	const [status, setStatus] = useState('ready');
	const [isResuming, setIsResuming] = useState(false);
	const messagesEndRef = useRef(null);
	const eventSourceRef = useRef(null);

	// Persist state to sessionStorage
	const saveState = () => {
		const state = {
			messages,
			isStreaming,
			streamingContent,
			currentSession,
			lastChunkIndex,
			timestamp: Date.now()
		};
		try {
			// Store in memory instead of localStorage (artifact restriction)
			window.chatState = state;
		} catch (error) {
			console.warn('Could not save state:', error);
		}
	};

	// Restore state from sessionStorage
	const restoreState = () => {
		try {
			const state = window.chatState;
			if (state) {
				const timeDiff = Date.now() - state.timestamp;
				// Only restore if less than 5 minutes old
				if (timeDiff < 5 * 60 * 1000) {
					console.log('Restoring state from memory:', state);
					setMessages(state.messages || []);
					setStreamingContent(state.streamingContent || '');
					setCurrentSession(state.currentSession);
					setLastChunkIndex(state.lastChunkIndex || 0);

					if (state.isStreaming && state.currentSession) {
						console.log(`Resuming stream for session: ${state.currentSession} from chunk: ${state.lastChunkIndex}`);
						setIsStreaming(true);
						// Small delay to ensure state is set
						setTimeout(() => {
							connectToStream(state.currentSession, state.lastChunkIndex);
						}, 100);
					}
					return true;
				}
			}
		} catch (error) {
			console.warn('Could not restore state:', error);
		}
		return false;
	};

	// Save state whenever important state changes
	useEffect(() => {
		saveState();
	}, [messages, isStreaming, streamingContent, currentSession, lastChunkIndex]);

	// Restore state on mount
	useEffect(() => {
		const restored = restoreState();
		if (restored) {
			console.log('State restored from previous session');
			setIsResuming(true);
			// Clear resuming flag after a moment
			setTimeout(() => setIsResuming(false), 3000);
		}
	}, []);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages, streamingContent]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}
		};
	}, []);

	// Auto-reconnect on page visibility
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden && currentSession && isStreaming) {
				console.log('Page visible again, reconnecting...');
				connectToStream(currentSession, lastChunkIndex);
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
	}, [currentSession, isStreaming, lastChunkIndex]);

	const connectToStream = (sessionId, fromIndex = 0) => {
		// Close existing connection
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
		};

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				console.log('Received data:', data);

				if (data.type === 'content') {
					setStreamingContent(prev => prev + data.content);
					setLastChunkIndex(data.chunkIndex + 1);
				} else if (data.type === 'done') {
					console.log('Stream completed');
					// Move streaming content to messages
					setStreamingContent(current => {
						if (current) {
							setMessages(prev => [...prev, { role: 'assistant', content: current }]);
						}
						return '';
					});

					// Reset state
					setIsStreaming(false);
					setCurrentSession(null);
					setLastChunkIndex(0);
					setStatus('ready');
					eventSource.close();

					// Clear saved state
					try {
						delete window.chatState;
					} catch (error) {
						console.warn('Could not clear state:', error);
					}
				} else if (data.type === 'error') {
					console.error('Stream error:', data.error);
					setMessages(prev => [...prev, {
						role: 'assistant',
						content: 'Sorry, there was an error processing your request.'
					}]);
					setStreamingContent('');
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

			// Auto-reconnect after 2 seconds if still streaming
			if (sessionId && isStreaming) {
				setTimeout(() => {
					console.log('Attempting reconnect...');
					connectToStream(sessionId, lastChunkIndex);
				}, 2000);
			}
		};
	};

	const sendMessage = async () => {
		if (!input.trim() || isStreaming) return;

		const userMessage = { role: 'user', content: input };
		setMessages(prev => [...prev, userMessage]);
		const messageText = input;
		setInput('');

		// Reset streaming state
		setIsStreaming(true);
		setStreamingContent('');
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
					<h1 className="text-xl font-semibold text-white">Simple Resumable Chat</h1>
					<div className="ml-auto flex items-center gap-4">
						{isResuming && (
							<div className="text-sm text-green-400 flex items-center gap-2 animate-pulse">
								<RefreshCw className="w-4 h-4" />
								Resumed from previous session
							</div>
						)}
						{currentSession && (
							<div className="text-xs text-gray-400 font-mono">
								{currentSession.slice(0, 8)}... (chunk: {lastChunkIndex})
							</div>
						)}
						{status === 'reconnecting' && (
							<button
								onClick={() => connectToStream(currentSession, lastChunkIndex)}
								className="p-1 rounded-full bg-orange-500/20 hover:bg-orange-500/30 transition-colors"
								title="Manual reconnect"
							>
								<RefreshCw className="w-4 h-4 text-orange-400" />
							</button>
						)}
						<div className="flex items-center gap-2">
							<div className={`w-2 h-2 rounded-full ${statusInfo.color}`}></div>
							<span className="text-sm text-gray-300">{statusInfo.text}</span>
						</div>
					</div>
				</div>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-4">
				<div className="max-w-4xl mx-auto space-y-6">
					{messages.length === 0 && (
						<div className="text-center py-12">
							<div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
								<Bot className="w-8 h-8 text-white" />
							</div>
							<h2 className="text-2xl font-bold text-white mb-2">Simple Resumable AI Chat</h2>
							<p className="text-gray-400">Try closing the tab while AI responds - it will resume!</p>
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

					{/* Current streaming message */}
					{isStreaming && (
						<div className="flex gap-4 justify-start">
							<div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
								{status === 'streaming' ? (
									<Bot className="w-5 h-5 text-white" />
								) : (
									<Loader className="w-5 h-5 text-white animate-spin" />
								)}
							</div>
							<div className="max-w-3xl rounded-2xl p-4 bg-gray-800/50 backdrop-blur-sm text-gray-100 border border-gray-700/50">
								{streamingContent ? (
									<>
										<div className="whitespace-pre-wrap break-words">{streamingContent}</div>
										<div className="inline-flex items-center mt-1">
											<div className="w-1 h-4 bg-purple-500 animate-pulse"></div>
										</div>
										{status === 'reconnecting' && (
											<div className="mt-2 text-xs text-orange-400 flex items-center gap-1">
												<RefreshCw className="w-3 h-3 animate-spin" />
												Reconnecting... (content preserved)
											</div>
										)}
									</>
								) : (
									<div className="flex items-center gap-2">
										<div className="flex gap-1">
											<div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
											<div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
											<div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
										</div>
										<span className="text-sm text-gray-400">{statusInfo.text}</span>
									</div>
								)}
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
								placeholder="Type your message... (Try closing tab during response!)"
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

export default SimpleResumableChat;
