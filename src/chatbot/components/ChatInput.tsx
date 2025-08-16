import { FormEvent, useState } from "react"

interface Props {
	onSubmit: (input: string) => Promise<void>;
	isProcessing: boolean;
}

export default function ChatInput({ onSubmit, isProcessing }: Props) {
	const [inputValue, setInputValue] = useState("write an extremely large essay on quantum mechanics minimum 10000 words")
	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		try {
			await onSubmit(inputValue)
		} catch (error) {
			console.log("@@ERROR SUBMITING FORM", error)
		} finally {
			setInputValue("")
		}
	}
	return (
		<div className="p-4 border-t border-gray-200 bg-white">
			<form onSubmit={handleSubmit} className="flex gap-3">
				<input
					type="text"
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					placeholder="Type your message..."
					disabled={isProcessing}
					className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
					autoFocus
				/>
				<button
					type="submit"
					disabled={!inputValue.trim() || isProcessing}
					className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 font-medium shadow-sm"
				>
					{isProcessing ? '...' : 'Send'}
				</button>
			</form>
		</div>

	)
}
