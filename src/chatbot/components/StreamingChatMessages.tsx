import { useEffect, useRef } from 'react';
import { LocalMessage } from "../types/chat.type";
import { getSyncColor } from '@/lib/utils';

interface Props {
	messages: LocalMessage[];
	streamingMessageId?: string | null;
}

export default function StreamingChatMessages({ messages, streamingMessageId }: Props) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages, streamingMessageId]);

	return (
		<div className="flex-1 overflow-y-auto p-4 space-y-4">
			{messages.map((message) => (
				<div
					key={message.id}
					className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
				>
					<div
						className={`max-w-[80%] rounded-lg px-4 py-2 ${message.sender === 'user'
							? 'bg-blue-500 text-white'
							: 'bg-gray-100 text-gray-900'
							}`}
					>
						<div className="whitespace-pre-wrap">
							{message.text}
							{/* Show typing indicator for streaming message */}
							{streamingMessageId === message.id && message.sender === 'ai' && (
								<span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
							)}
							<div className={`size-2 rounded-full ${getSyncColor(message.syncStatus)}`} />
						</div>
						{/* Show sync status if needed */}
						{message.syncStatus === 'error' && (
							<div className="text-xs text-red-500 mt-1">Failed to send</div>
						)}
					</div>
				</div>
			))}
			<div ref={messagesEndRef} />
		</div>
	);
}
