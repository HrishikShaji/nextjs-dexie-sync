import chatDB from "@/chatbot/local/chat-db"
import { liveQuery } from "dexie"

type SocketType = "CREATE_CONVERSATION_REQUEST" | "MESSAGE_SYNC_REQUEST"

function sendSocket({ type, data }: { type: SocketType; data: any }) {
  if (socket.readyState === WebSocket.OPEN) {
    console.log("@@SENDING SOCKET:", type)
    socket.send(JSON.stringify({
      type,
      data
    }))
  } else {
    console.log("@@SOCKET NOT READY")
  }

}

async function updateMessageSyncStatus({
  messageId,
  conversationId,
  status
}: {
  messageId: string;
  conversationId: string;
  status: "error" | "syncing" | "synced" | "pending"
}) {
  console.log("@@SYNCING MESSAGE", messageId, status)
  await chatDB.conversations.where("id").equals(conversationId).modify((conversation) => {
    conversation.syncStatus = status
    conversation.messages = conversation.messages.map((msg) => {
      if (msg.id === messageId) {
        return {
          ...msg,
          syncStatus: status
        }
      }
      return msg
    })
  })

}

async function onMessageSync(data: any) {
  await updateMessageSyncStatus({
    messageId: data.id,
    conversationId: data.conversationId,
    status: data.status
  })
}

async function onConversationSync(data: any) {
  console.log("@@CONVERSATION-SYNC-RESPONSE", data)
  await chatDB.conversations.where("id").equals(data.id).modify({
    syncStatus: "synced",
  });
}

const socket = new WebSocket('ws://localhost:3001')

socket.onopen = () => {
  console.log("@@CONNECTED IN WEB WORKER")
}

socket.onclose = () => {
  console.log("@@CLOSED IN WEB WORKER")
}

socket.onerror = () => {
  console.log("@@SOCKET ERROR IN WEB WORKER")
}

socket.onmessage = async (event) => {
  try {
    const parsedData = JSON.parse(event.data)
    switch (parsedData.type) {
      case "MESSAGE_SYNC_RESPONSE":
        await onMessageSync(parsedData.data);
        break;
      case "CREATE_CONVERSATION_RESPONSE":
        await onConversationSync(parsedData.data);
        break;
      default:
        // console.log("Unknown message type:", parsedData.type);
        break;
    }
  } catch (err) {
    console.log("@@SOCKET ERROR", err)
  }
}

const observable = liveQuery(async () => {
  const [newConversations, pendingConversations, erroredConversations] = await Promise.all([
    chatDB.conversations.where("syncStatus").equals("new").toArray(),
    chatDB.conversations.where("syncStatus").equals("pending").toArray(),
    chatDB.conversations.where("syncStatus").equals("error").toArray()
  ])

  return {
    newConversations,
    pendingConversations,
    erroredConversations,
    timestamp: Date.now() // Force update detection
  }
})

observable.subscribe({
  next: async (result) => {
    console.log("DB CHANGE", result)

    if (result.newConversations.length > 0) {
      for (const newConversation of result.newConversations) {
        sendSocket({
          type: "CREATE_CONVERSATION_REQUEST",
          data: newConversation
        })
      }
    }

    if (result.pendingConversations.length > 0) {
      for (const unsyncedConversation of result.pendingConversations) {
        const unsyncedMessages = unsyncedConversation.messages.filter(msg => msg.syncStatus === "pending")
        for (const unsyncedMessage of unsyncedMessages) {
          await updateMessageSyncStatus({
            messageId: unsyncedMessage.id,
            conversationId: unsyncedConversation.id,
            status: "syncing"
          })
          sendSocket({
            type: "MESSAGE_SYNC_REQUEST",
            data: { ...unsyncedMessage, conversationId: unsyncedConversation.id }
          })
        }
      }
    }

    if (result.erroredConversations.length > 0) {
      for (const erroredConversation of result.erroredConversations) {
        const erroredMessages = erroredConversation.messages.filter((msg) => msg.syncStatus === "error")
        for (const erroredMessage of erroredMessages) {
          await updateMessageSyncStatus({
            messageId: erroredMessage.id,
            conversationId: erroredConversation.id,
            status: "syncing"
          })
          sendSocket({
            type: "MESSAGE_SYNC_REQUEST",
            data: { ...erroredMessage, conversationId: erroredConversation.id }
          })
        }
      }
    }

  }
})

export { }
