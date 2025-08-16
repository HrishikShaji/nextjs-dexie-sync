import { Bot, Loader, Trash2 } from "lucide-react";
import { LocalMessage } from "../types/chat.type";

interface Props {
	currentSession: string | null;
	lastChunkIndex: number;
	messages: LocalMessage[];
	clearChat: () => void;
	status: string;
}
const getStatusInfo = (status: string) => {
	switch (status) {
		case 'ready': return { color: 'bg-gray-400', text: 'Ready' };
		case 'starting': return { color: 'bg-yellow-400 animate-pulse', text: 'Starting...' };
		case 'connecting': return { color: 'bg-blue-400 animate-pulse', text: 'Connecting...' };
		case 'streaming': return { color: 'bg-green-400 animate-pulse', text: 'Streaming' };
		case 'reconnecting': return { color: 'bg-orange-400 animate-pulse', text: 'Reconnecting...' };
		case 'disconnected': return { color: 'bg-red-400', text: 'Disconnected' };
		default: return { color: 'bg-gray-400', text: 'Ready' };
	}
};


export default function ConnectionStatus({ status, clearChat, currentSession, lastChunkIndex, messages }: Props) {
	const statusInfo = getStatusInfo(status);
	return (
		<>
			<div className="bg-black/20 backdrop-blur-sm border-b border-purple-500/20 p-4">
				<div className="max-w-4xl mx-auto flex items-center gap-3">
					<div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
						<Bot className="w-5 h-5 text-white" />
					</div>
					<h1 className="text-xl font-semibold text-white">Auto-Resume Streaming Chat</h1>
					<div className="ml-auto flex items-center gap-4">
						{messages.length > 0 && (
							<button
								onClick={clearChat}
								className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2"
							>
								<Trash2 className="w-4 h-4" />
								Clear Chat
							</button>
						)}
						{currentSession && (
							<div className="text-xs text-gray-400 font-mono">
								{currentSession.slice(0, 8)}... (chunk: {lastChunkIndex})
							</div>
						)}
						<div className="flex items-center gap-2">
							<div className={`w-2 h-2 rounded-full ${statusInfo.color}`}></div>
							<span className="text-sm text-gray-300">{statusInfo.text}</span>
						</div>
					</div>
				</div>
			</div>

			{/* Auto-Resume Notification */}
			{status === 'connecting' && currentSession && (
				<div className="bg-blue-500/20 border-b border-blue-500/30 p-3">
					<div className="max-w-4xl mx-auto flex items-center gap-3">
						<Loader className="w-5 h-5 text-blue-400 animate-spin" />
						<div className="flex-1 text-blue-300">
							<strong>Resuming stream...</strong> Automatically continuing from where you left off.
						</div>
					</div>
				</div>
			)}

			{/* Reconnecting Notification */}
			{status === 'reconnecting' && (
				<div className="bg-orange-500/20 border-b border-orange-500/30 p-3">
					<div className="max-w-4xl mx-auto flex items-center gap-3">
						<Loader className="w-5 h-5 text-orange-400 animate-spin" />
						<div className="flex-1 text-orange-300">
							<strong>Connection lost!</strong> Automatically retrying in a few seconds...
						</div>
					</div>
				</div>
			)}

		</>
	)
}
