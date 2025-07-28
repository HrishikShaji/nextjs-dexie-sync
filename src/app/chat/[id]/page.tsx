import ChatInterface from "@/chatbot/components/ChatInterface"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (<ChatInterface activeConversation={id} />)
}
