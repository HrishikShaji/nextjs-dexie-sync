import { Dispatch, SetStateAction, useCallback, useEffect } from "react";
import { LocalConversation, SyncResponse, SyncResult } from "../types/chat.type"
import chatDB from "../local/chat-db";
import ConversationCard from "./ConversationCard";
import { syncConversations } from "../lib/syncConversations";
import { syncDeletions } from "../lib/syncDeletions";

interface Props {
	conversations: LocalConversation[];
	setConversations: Dispatch<SetStateAction<LocalConversation[]>>;
	activeConversation: string | null;
	setActiveConversation: Dispatch<SetStateAction<string | null>>;
}

export default function Sidebar({ conversations, setConversations, setActiveConversation, activeConversation }: Props) {
	useEffect(() => {
		loadConversations();
	}, []);

	useEffect(() => {

		const autoSync = async () => {
			const unsyncedConversations = await chatDB.conversations
				.where("syncStatus")
				.equals("pending")
				.toArray();
			if (unsyncedConversations.length > 0) {
				console.log("Auto-syncing batch of pending items:", unsyncedConversations);
				syncConversations({
					unsyncedConversations,
					onSuccess: (conversations) => setConversations(conversations)
				});
			}
		};

		const interval = setInterval(autoSync, 5000); // Batch sync every 5 seconds
		return () => clearInterval(interval);
	}, [syncConversations]);


	useEffect(() => {
		const autoSync = async () => {
			const unsyncedDeletions = await chatDB.deleteQueue
				.where("syncStatus")
				.equals("pending")
				.toArray();
			if (unsyncedDeletions.length > 0) {
				const unsyncedDeletionIds = unsyncedDeletions.map((del) => del.id)
				console.log("Auto-syncing batch of pending items:", unsyncedDeletionIds);
				syncDeletions({ unsyncedDeletionIds })
			}
		};

		const interval = setInterval(autoSync, 3000); // Batch sync every 5 seconds
		return () => clearInterval(interval);
	}, [syncDeletions])

	const loadConversations = useCallback(async () => {
		try {
			// Load all conversations from IndexedDB - fully local
			const localConversations = await chatDB.conversations.orderBy('id').reverse().toArray();
			const mappedConversations: LocalConversation[] = localConversations.map(conv => ({
				id: conv.id,
				title: conv.title,
				messages: conv.messages.map(msg => ({
					id: msg.id,
					text: msg.text,
					sender: msg.sender,
					syncStatus: msg.syncStatus
				})),
				syncStatus: conv.syncStatus
			}));

			setConversations(mappedConversations);

			// Set active conversation if none exists
			if (!activeConversation && mappedConversations.length > 0) {
				setActiveConversation(mappedConversations[0].id);
			} else if (mappedConversations.length === 0) {
				createNewConversation();
			}
		} catch (error) {
			console.error('Failed to load conversations from local storage:', error);
			// Create a new conversation as fallback
			createNewConversation();
		}
	}, [activeConversation]);


	const createNewConversation = useCallback(async () => {
		const id = crypto.randomUUID();
		const title = `New Chat ${Date.now()}`;


		// Store completely locally in IndexedDB
		const localConversation: LocalConversation = {
			id,
			title,
			syncStatus: "pending", // Mark as local-only
			messages: [],
		};

		try {
			// Save to local IndexedDB first
			await chatDB.conversations.add(localConversation);

			// Update local state
			setConversations(prev => [localConversation, ...prev]);
			setActiveConversation(id);

		} catch (error) {
			console.error('Failed to create local conversation:', error);
			// Still update UI even if DB fails
			setConversations(prev => [localConversation, ...prev]);
			setActiveConversation(id);
		}

	}, []);

	const switchConversation = useCallback((conversationId: string) => {
		if (conversationId === activeConversation) return;
		setActiveConversation(conversationId);
	}, [activeConversation]);


	const deleteConversation = useCallback(async (conversationId: string) => {

		try {
			// Delete from local IndexedDB
			await chatDB.deleteQueue.add({
				id: conversationId,
				syncStatus: "pending"
			})
			await chatDB.conversations.delete(conversationId);

			// Update local state
			const updatedConversations = conversations.filter(c => c.id !== conversationId);
			setConversations(updatedConversations);

			if (activeConversation === conversationId) {
				if (updatedConversations.length > 0) {
					setActiveConversation(updatedConversations[0].id);
				} else {
					await createNewConversation();
				}
			}
		} catch (error) {
			console.error('Failed to delete local conversation:', error);
			// Still update UI even if delete fails
			const updatedConversations = conversations.filter(c => c.id !== conversationId);
			setConversations(updatedConversations);

			if (activeConversation === conversationId && updatedConversations.length > 0) {
				setActiveConversation(updatedConversations[0].id);
			}
		}
	}, [conversations, activeConversation, createNewConversation]);



	return (
		<div className="w-64 bg-white border-r border-gray-200 flex flex-col">
			<div className="p-2 border-b border-gray-100">
				<button
					onClick={createNewConversation}
					className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors duration-150 shadow-sm"
					title="New Chat (Ctrl+N)"
				>
					+ New Chat
				</button>
			</div>

			<div className="flex-1 overflow-y-auto">
				{conversations.map((conversation) => (
					<ConversationCard
						key={conversation.id}
						conversation={conversation}
						activeConversation={activeConversation}
						deleteConversation={deleteConversation}
						switchConversation={switchConversation}
					/>
				))}

				{conversations.length === 0 && (
					<div className="p-4 text-center text-gray-500 text-sm">
						No conversations yet.<br />
						Create your first chat!
					</div>
				)}
			</div>

			<div className="p-2 border-t border-gray-100 text-xs text-gray-400 text-center">
				{conversations.length} conversation{conversations.length !== 1 ? 's' : ''} stored locally
			</div>
		</div>

	)
}
