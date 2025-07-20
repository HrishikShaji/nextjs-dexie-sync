
export type Message = {
	id: string;
	text: string;
	sender: 'user' | 'ai';
};

export type Conversation = {
	id: string;
	title: string;
	messages: Message[];
};


export type LocalMessage = {
	id: string;
	text: string;
	sender: 'user' | 'ai';
	syncStatus: "pending" | "synced" | "error";
}

export type LocalConversation = {
	id: string;
	title: string;
	messages: LocalMessage[];
	syncStatus: "pending" | "synced" | "error";
};

