import { delay } from "@/lib/utils";

const aiResponses = [
	"I'm an AI assistant. How can I help you today?",
	"That's an interesting question. Let me think about that...",
	"Based on my knowledge, I'd suggest considering multiple perspectives.",
	"I don't have enough information to answer that fully.",
	"Could you clarify your question? I want to make sure I understand.",
	"Thanks for asking! Here's what I know about that topic...",
	"I'm designed to be helpful, harmless, and honest in my responses.",
	"That's outside my current capabilities, but I can try to point you in the right direction."
]
export const generateAIResponse = async () => {
	await delay(2000)

	return aiResponses[Math.floor(Math.random() * aiResponses.length)];
};
