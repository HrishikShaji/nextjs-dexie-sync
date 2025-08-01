import Sidebar from "@/chatbot/components/Sidebar"
import { ConversationProvider } from "@/chatbot/contexts/ConversationContext"
import SyncWorkerProvider from "@/providers/SyncWorkerProvider"

export default function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex h-screen bg-gray-50">
      <ConversationProvider>
        <SyncWorkerProvider>
          <Sidebar />
          {children}
        </SyncWorkerProvider>
      </ConversationProvider>
    </div>
  )
}
