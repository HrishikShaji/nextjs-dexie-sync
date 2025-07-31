"use client"

import React, { createContext, Dispatch, SetStateAction, useContext, useState } from 'react';

type ConversationContextType = {
	activeConversation: string | null;
	setActiveConversation: React.Dispatch<React.SetStateAction<string | null>>;
	initialInput: string;
	setInitialInput: Dispatch<SetStateAction<string>>;
};

// Create the context with a default value
const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

// Create a provider component
export const ConversationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [activeConversation, setActiveConversation] = useState<string | null>(null);
	const [initialInput, setInitialInput] = useState("")

	return (
		<ConversationContext.Provider
			value={{
				activeConversation,
				setActiveConversation,
				initialInput,
				setInitialInput
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
