import Sidebar from "@/chatbot/components/Sidebar4"
import { ConversationProvider } from "@/chatbot/contexts/ConversationContext"

export default function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex h-screen bg-gray-50">
      <ConversationProvider>
        <Sidebar />
        {children}
      </ConversationProvider>
    </div>
  )
}
