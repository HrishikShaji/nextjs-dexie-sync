"use client"

import React, { createContext, useContext, useState } from 'react';
import { LocalConversation } from '../types/chat.type';

type ConversationContextType = {
	conversations: LocalConversation[];
	setConversations: React.Dispatch<React.SetStateAction<LocalConversation[]>>;
	activeConversation: string | null;
	setActiveConversation: React.Dispatch<React.SetStateAction<string | null>>;
};

// Create the context with a default value
const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

// Create a provider component
export const ConversationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [conversations, setConversations] = useState<LocalConversation[]>([]);
	const [activeConversation, setActiveConversation] = useState<string | null>(null);

	return (
		<ConversationContext.Provider
			value={{
				conversations,
				setConversations,
				activeConversation,
				setActiveConversation
			}}
		>
			{children}
		</ConversationContext.Provider>
	);
};

// Create a custom hook for using the context
export const useConversationContext = () => {
	const context = useContext(ConversationContext);
	if (context === undefined) {
		throw new Error('useConversationContext must be used within a ConversationProvider');
	}
	return context;
};
