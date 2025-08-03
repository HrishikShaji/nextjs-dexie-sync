import AdvancedInterface from "@/chatbot/components/AdvancedInterface"
import ChatInterface from "@/chatbot/components/ChatInterface"
import ChatIntro from "@/chatbot/components/ChatIntro"
import SimpleInterface from "@/chatbot/components/SimpleInterface"
import StreamingInterface from "@/chatbot/components/StreamingInterface"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!id) return <ChatIntro />

  return (<StreamingInterface activeConversation={id} />)
}
