import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { useConversationContext } from "../contexts/ConversationContext";
import { LocalConversation, LocalMessage } from "../types/chat.type";
import chatDB from "../local/chat-db";

export default function ChatIntro() {
	const [inputValue, setInputValue] = useState<string>('');
	const [isProcessing, setIsProcessing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const router = useRouter()
	const { setActiveConversation, setConversations } = useConversationContext()

	async function handleFirstMessage(e: FormEvent) {
		e.preventDefault()
		setIsProcessing(true)
		const id = crypto.randomUUID();
		const title = inputValue;

		const aiMessage: LocalMessage = {
			id: crypto.randomUUID(),
			text: inputValue,
			sender: 'user',
			syncStatus: "pending",
		};

		const localConversation: LocalConversation = {
			id,
			title,
			syncStatus: "pending",
			messages: [aiMessage],
			localCreatedAt: new Date()
		};

		try {
			const newConversations = await chatDB.conversations.add(localConversation);
			console.log("@@NEW CONVERSATIONS", newConversations)
			setConversations(prev => [localConversation, ...prev]);
			setActiveConversation(id);

			router.push(`/chat/${id}`)
		} catch (error) {
			console.error('Failed to create local conversation:', error);
			setConversations(prev => [localConversation, ...prev]);
			setActiveConversation(id);
		} finally {

		}


	}

	return (
		<div className="flex-1 flex flex-col">
			<div className="flex-1 p-6 overflow-y-auto flex items-center justify-center bg-gray-50 scroll-smooth">
				<div className="text-center mt-12 text-gray-500">
					<div className="bg-white rounded-lg p-8 shadow-sm max-w-md mx-auto">
						<h3 className="text-xl font-semibold mb-2 text-gray-700">
							Start a new conversation
						</h3>
						<p className="text-gray-600">
							Ask me anything and I'll respond instantly!
						</p>
					</div>
				</div>
			</div>
			<div className="p-4 border-t border-gray-200 bg-white">
				<form onSubmit={handleFirstMessage} className="flex gap-3">
					<input
						ref={inputRef}
						type="text"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						placeholder="Type your message..."
						className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
						autoFocus
					/>
					<button
						type="submit"
						disabled={!inputValue.trim()}
						className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 font-medium shadow-sm"
					>
						{isProcessing ? '...' : 'Send'}
					</button>
				</form>
			</div>
		</div>
	)
}

