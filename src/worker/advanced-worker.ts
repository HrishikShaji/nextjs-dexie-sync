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
  //	console.log("@@CONVERSATION-SYNC-RESPONSE", data)
  await chatDB.conversations.where("id").equals(data.id).modify({
    syncStatus: "synced",
  });
}

const observable = liveQuery(async () => {
  const [newConversations, pendingConversations, erroredConversations] = await Promise.all([
    chatDB.conversations.where("syncStatus").equals("new").toArray(),
    chatDB.conversations.where("syncStatus").equals("pending").toArray(),
    chatDB.conversations.where("syncStatus").equals("error").toArray()
  ])

  return {
    hasNew: newConversations.length > 0,
    hasPending: pendingConversations.length > 0,
    hasErrored: erroredConversations.length > 0,
    timestamp: Date.now() // Force update detection
  }
})
const socket = new WebSocket('ws://localhost:3001')

socket.onopen = () => {
  console.log("@@CONNECTED IN WEB WORKER")
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

socket.onclose = () => {
  console.log("@@CLOSED IN WEB WORKER")
}

socket.onerror = () => {
  console.log("@@SOCKET ERROR IN WEB WORKER")
}

observable.subscribe({
  next: async (result) => {
    console.log("DB CHANGE", result)

    if (result.hasNew) {
      const newConversation = await chatDB.conversations.where("syncStatus").equals("new").first()
      sendSocket({
        type: "CREATE_CONVERSATION_REQUEST",
        data: newConversation
      })

    }

    if (result.hasPending) {
      const unsyncedConversation = await chatDB.conversations.where("syncStatus").equals("pending").first()
      console.log("@@SYNCING MESSAGE WITH CONVERSATION", unsyncedConversation)
      if (unsyncedConversation) {
        const unsyncedMessages = unsyncedConversation.messages.filter(msg => msg.syncStatus === "pending")
        console.log("@@UNSYNCED MESSAGES", unsyncedMessages)
        const unsyncedMessage = unsyncedMessages[0]
        if (unsyncedMessage) {
          console.log("@@SYNCING MESSAGE", unsyncedMessage)
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

    if (result.hasErrored) {
      console.log("SYNCING ERRORED MESSAGES")
      const erroredConversation = await chatDB.conversations.where("syncStatus").equals("error").first()
      console.log("ERRORED CONVERSATION:", erroredConversation)
      if (erroredConversation) {
        const erroredMessages = erroredConversation.messages.filter((msg) => msg.syncStatus === "error")
        const erroredMessage = erroredMessages[0]
        if (erroredMessage) {
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
