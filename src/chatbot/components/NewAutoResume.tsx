"use client"
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader, Trash2 } from 'lucide-react';
import chatDB from '../local/chat-db';
import ConnectionStatus from './ConnectionStatus';
import StreamingChatMessages from './StreamingChatMessages';
import ChatInput from './ChatInput';
import { LocalConversation, LocalMessage } from '../types/chat.type';
import { useLiveQuery } from 'dexie-react-hooks';

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

async function updateStreamComplete(conversationId: string) {
	await chatDB.conversations.where("id").equals(conversationId).modify((conversation) => {
		const { sessionMetadata, ...newConversation } = conversation
		conversation = newConversation
	})

}

const NewAutoResume = () => {
	const [isStreaming, setIsStreaming] = useState(false);
	const [status, setStatus] = useState('ready');
	const [streamingMessageId, setStreamingMessageId] = useState(null)
	const eventSourceRef = useRef<EventSource>(null);
	const hasAutoResumed = useRef(false);
	const CONVERSATION_ID = 'resumable_chat_session';

	const liveConversation = useLiveQuery(() =>
		chatDB.conversations.where("id").equals(CONVERSATION_ID).first(),
		[]
	)

	const messages = liveConversation?.messages || []

	const clearDexie = async () => {
		try {
			await chatDB.conversations.delete(CONVERSATION_ID);
		} catch (error) {
			console.error('Failed to clear Dexie:', error);
		}
	};


	useEffect(() => {
		const initializeSession = async () => {
			const sessionInfo = liveConversation?.sessionMetadata;

			if (!sessionInfo) return
			// Auto-resume if there's a session and we haven't already resumed
			if (!hasAutoResumed.current) {
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
	}, [liveConversation]);

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
				} else if (data.type === 'done') {
					console.log('Stream completed');
					setIsStreaming(false);
					setStatus('ready');
					await updateStreamComplete(CONVERSATION_ID)
					eventSource.close();
				} else if (data.type === 'error') {
					console.error('Stream error:', data.error);
					setIsStreaming(false);
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
		const messageText = input;

		setIsStreaming(true);
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

			connectToStream(sessionId, 0, assistantMessage.id);

		} catch (error: any) {
			console.error('Error starting chat:', error);
			setIsStreaming(false);
			setStatus('ready');
		}
	};

	const clearChat = async () => {
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
					lastChunkIndex={liveConversation?.sessionMetadata?.chunkIndex}
					messages={messages}
					clearChat={clearChat}
					currentSession={liveConversation?.sessionMetadata?.sessionId}
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
