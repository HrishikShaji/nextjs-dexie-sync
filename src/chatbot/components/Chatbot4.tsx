"use client"
import React, { useState } from 'react';
import { LocalConversation } from '../types/chat.type';
import Sidebar from './Sidebar2';
import ChatInterface from './ChatInterface2';

export default function Chatbot() {
	const [conversations, setConversations] = useState<LocalConversation[]>([]);
	const [activeConversation, setActiveConversation] = useState<string | null>(null);

	const updateConversationTitle = (title: string) => {
		setConversations(prev =>
			prev.map(conv =>
				conv.id === activeConversation
					? {
						...conv,
						title,
					}
					: conv
			)
		);

	}

	return (
		<div className="flex h-full bg-gray-50">
			<Sidebar
				conversations={conversations}
				setActiveConversation={setActiveConversation}
				setConversations={setConversations}
				activeConversation={activeConversation}
			/>
			<ChatInterface
				activeConversation={activeConversation}
				updateConversationTitle={updateConversationTitle}
			/>
		</div>
	);
}
