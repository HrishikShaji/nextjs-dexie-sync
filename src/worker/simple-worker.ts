import chatDB from "@/chatbot/local/chat-db"
import { liveQuery } from "dexie"

console.log("@@SIMPLE WORKER INITIATED")
async function onMessageSync(data: any) {
  console.log("@@MESSAGE-SYNC-RESPONSE:", data)
  await chatDB.conversations.where("id").equals(data.conversationId).modify((conversation) => {
    conversation.syncStatus = data.status;
    conversation.messages = conversation.messages.map((msg) => {
      if (msg.id === data.id) {
        return {
          ...msg,
          syncStatus: data.status
        }
      }
      return msg
    })
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
    const newConversation = await chatDB.conversations.where("syncStatus").equals("new").first()

    if (result.hasNew) {
      //console.log("@@CREATING CONVERSATION", newConversation)
      if (socket.readyState === WebSocket.OPEN) {
        //console.log("@@SENDING CREATE_CONVERSATION_REQUEST")
        socket.send(JSON.stringify({
          type: "CREATE_CONVERSATION_REQUEST",
          data: newConversation
        }))
      } else {
        console.log("**SOCKET NOT READY")
      }

    }

    if (result.hasPending) {
      const unsyncedConversation = await chatDB.conversations.where("syncStatus").equals("pending").first()
      console.log("@@SYNCING MESSAGE WITH CONVERSATION", unsyncedConversation)
      if (unsyncedConversation && socket.readyState === WebSocket.OPEN) {
        const unsyncedMessages = unsyncedConversation.messages.filter(msg => msg.syncStatus === "pending")
        console.log("@@UNSYNCED MESSAGES", unsyncedMessages)
        const unsyncedMessage = unsyncedMessages[0]
        if (unsyncedMessage) {
          console.log("@@SYNCING MESSAGE", unsyncedMessage)
          await chatDB.conversations.where("id").equals(unsyncedConversation.id).modify((conversation) => {
            conversation.messages = conversation.messages.map((msg) => {
              if (msg.id === unsyncedMessage.id) {
                return {
                  ...msg,
                  syncStatus: "syncing"
                }
              }
              return msg
            })
          })
          socket.send(JSON.stringify({
            type: "MESSAGE_SYNC_REQUEST",
            data: { ...unsyncedMessage, conversationId: unsyncedConversation.id }
          }))
        }
      } else {
        console.log("**SOCKET NOT READY")
      }

    }

    if (result.hasErrored) {
      console.log("SYNCING ERRORED MESSAGES")
      const erroredConversation = await chatDB.conversations.where("syncStatus").equals("error").first()
      console.log("ERRORED CONVERSATION:", erroredConversation)
      if (erroredConversation && socket.readyState === WebSocket.OPEN) {
        const erroredMessages = erroredConversation.messages.filter((msg) => msg.syncStatus === "error")
        const erroredMessage = erroredMessages[0]
        if (erroredMessage) {
          console.log("@@SYNCING ERRORED MESSAGE", erroredMessage)
          await chatDB.conversations.where("id").equals(erroredConversation.id).modify((conversation) => {
            conversation.messages = conversation.messages.map((msg) => {
              if (msg.id === erroredMessage.id) {
                return {
                  ...msg,
                  syncStatus: "syncing"
                }
              }
              return msg
            })
          })
          socket.send(JSON.stringify({
            type: "MESSAGE_SYNC_REQUEST",
            data: { ...erroredMessage, conversationId: erroredConversation.id }
          }))

        }
      } else {
        console.log("SOCKET NOT READY")
      }
    }

  }
})

export { }
