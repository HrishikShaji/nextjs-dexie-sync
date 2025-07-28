import ChatInterface from "@/chatbot/components/ChatInterface4"

export default async function Page({ params }: { params: { id: string } }) {
  const { id } = await params
  return (<ChatInterface activeConversation={id} />)
}
