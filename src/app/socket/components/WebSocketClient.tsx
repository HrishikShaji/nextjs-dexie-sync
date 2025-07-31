'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
	type: string;
	message?: string;
	data?: any;
	timestamp?: string;
}

export default function WebSocketClient() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [inputMessage, setInputMessage] = useState('');
	const [isConnected, setIsConnected] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		// Initialize WebSocket connection
		const connectWebSocket = () => {
			wsRef.current = new WebSocket('ws://localhost:3001');

			wsRef.current.onopen = () => {
				setIsConnected(true);
				console.log('Connected to WebSocket');
			};

			wsRef.current.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);
					setMessages(prev => [...prev, message]);
				} catch (error) {
					console.error('Error parsing message:', error);
				}
			};

			wsRef.current.onclose = () => {
				setIsConnected(false);
				console.log('Disconnected from WebSocket');
			};

			wsRef.current.onerror = (error) => {
				console.error('WebSocket error:', error);
			};
		};

		connectWebSocket()


		// Cleanup on unmount
		return () => {
			if (wsRef.current) {
				wsRef.current.close();
			}
		};
	}, []);

	const sendMessage = () => {
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && inputMessage.trim()) {
			wsRef.current.send(JSON.stringify({
				text: inputMessage,
				sender: 'User'
			}));
			setInputMessage('');
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			sendMessage();
		}
	};

	return (
		<div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
			<h2 className="text-2xl font-bold mb-4">WebSocket Chat</h2>

			{/* Connection Status */}
			<div className="mb-4">
				<span className={`inline-block w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'
					}`}></span>
				<span className="text-sm">
					{isConnected ? 'Connected' : 'Disconnected'}
				</span>
			</div>

			{/* Messages */}
			<div className="h-64 overflow-y-auto mb-4 p-3 border rounded bg-gray-50">
				{messages.map((msg, index) => (
					<div key={index} className="mb-2 p-2 bg-white rounded shadow-sm">
						{msg.type === 'welcome' && (
							<p className="text-green-600 font-medium">{msg.message}</p>
						)}
						{msg.type === 'message' && (
							<div>
								<p className="text-sm text-gray-600">
									{msg.data?.sender}: {msg.data?.text}
								</p>
								<p className="text-xs text-gray-400">
									{new Date(msg.timestamp || '').toLocaleTimeString()}
								</p>
							</div>
						)}
					</div>
				))}
			</div>

			{/* Input */}
			<div className="flex gap-2">
				<input
					type="text"
					value={inputMessage}
					onChange={(e) => setInputMessage(e.target.value)}
					onKeyPress={handleKeyPress}
					placeholder="Type a message..."
					className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
					disabled={!isConnected}
				/>
				<button
					onClick={sendMessage}
					disabled={!isConnected || !inputMessage.trim()}
					className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 hover:bg-blue-600"
				>
					Send
				</button>
			</div>
		</div>
	);
}
