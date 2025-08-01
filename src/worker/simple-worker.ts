import chatDB from "@/chatbot/local/chat-db"
import { liveQuery } from "dexie"

console.log("@@SIMPLE WORKER INITIATED")

const observable = liveQuery(() => chatDB.conversations.toArray())

observable.subscribe({
  next: (result) => console.log("SUBSCRIPTION FIRED", result)
})

export { }
