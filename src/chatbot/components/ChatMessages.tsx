import { getSyncColor } from "@/lib/utils";
import { LocalMessage } from "../types/chat.type"
import { useCallback, useEffect, useRef } from "react";

interface Props {
	messages: LocalMessage[];
}

export default function ChatMessages({ messages }: Props) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [messages.length, scrollToBottom]);

	return (
		<div className="flex-1 p-6 overflow-y-auto bg-gray-50 scroll-smooth">
			{messages.map((message) => (
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
					<div className={`size-2 rounded-full ${getSyncColor(message.syncStatus)}`} />
				</div>
			))
			}
			<div ref={messagesEndRef} />
		</div>

	)
}
