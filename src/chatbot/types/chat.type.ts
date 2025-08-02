
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

export interface MessageSyncResult {
	conversationId: string;
	id: string;
	status: string;
}

export interface MessageSyncResponse {
	success: boolean;
	results: MessageSyncResult[];
}

export interface SyncResult {
	id: number;
	status: string;
}

export interface SyncResponse {
	success: boolean;
	results: SyncResult[];
}

export type LocalMessage = {
	id: string;
	text: string;
	sender: 'user' | 'ai';
	syncStatus: "pending" | "synced" | "error" | "syncing";
}

export type LocalConversation = {
	id: string;
	title: string;
	messages: LocalMessage[];
	syncStatus: "pending" | "synced" | "error" | "new" | "syncing";
	localCreatedAt?: Date;
};

