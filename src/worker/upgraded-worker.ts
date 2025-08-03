import chatDB from "@/chatbot/local/chat-db"
import { liveQuery } from "dexie"

// Configuration
interface Config {
  wsUrl: string
  maxRetries: number
  baseRetryDelay: number
  maxRetryDelay: number
  connectionTimeout: number
  heartbeatInterval: number
  maxConcurrentSyncs: number
}

const config: Config = {
  wsUrl: process.env.WEBSOCKET_URL || 'ws://localhost:3001',
  maxRetries: 5,
  baseRetryDelay: 1000,
  maxRetryDelay: 30000,
  connectionTimeout: 10000,
  heartbeatInterval: 30000,
  maxConcurrentSyncs: 5
}

// Types
type SocketType = "CREATE_CONVERSATION_REQUEST" | "MESSAGE_SYNC_REQUEST" | "HEARTBEAT"
type SyncStatus = "error" | "syncing" | "synced" | "pending" | "new"
type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting"

interface SyncItem {
  id: string
  conversationId: string
  type: 'message' | 'conversation'
  data: any
  retryCount: number
  lastAttempt: number
}

interface WebSocketMessage {
  type: string
  data: {
    id?: string
    conversationId?: string
    status?: SyncStatus
    error?: string
  }
}

// Enhanced WebSocket Manager
class WebSocketSyncManager {
  private socket: WebSocket | null = null
  private connectionState: ConnectionState = "disconnected"
  private retryQueue: Map<string, SyncItem> = new Map()
  private activeSyncs: Set<string> = new Set()
  private observable: any = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private connectionTimeout: NodeJS.Timeout | null = null
  private isShuttingDown = false

  constructor() {
    this.initializeConnection()
    this.setupObservable()
  }

  private initializeConnection() {
    if (this.isShuttingDown) return

    this.connectionState = "connecting"
    this.clearTimers()

    try {
      this.socket = new WebSocket(config.wsUrl)

      // Connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.connectionState === "connecting") {
          console.log("@@CONNECTION TIMEOUT")
          this.handleConnectionError()
        }
      }, config.connectionTimeout)

      this.socket.onopen = () => {
        console.log("@@WEBSOCKET CONNECTED")
        this.connectionState = "connected"
        this.clearConnectionTimeout()
        this.startHeartbeat()
        this.processRetryQueue()
      }

      this.socket.onclose = (event) => {
        console.log("@@WEBSOCKET CLOSED", event.code, event.reason)
        this.handleDisconnection()
      }

      this.socket.onerror = (error) => {
        console.log("@@WEBSOCKET ERROR", error)
        this.handleConnectionError()
      }

      this.socket.onmessage = async (event) => {
        try {
          await this.handleMessage(event)
        } catch (error) {
          console.error("@@ERROR HANDLING MESSAGE", error)
        }
      }

    } catch (error) {
      console.error("@@ERROR CREATING WEBSOCKET", error)
      this.handleConnectionError()
    }
  }

  private async handleMessage(event: MessageEvent) {
    let parsedData: WebSocketMessage

    try {
      parsedData = JSON.parse(event.data)
    } catch (error) {
      console.error("@@INVALID MESSAGE FORMAT", event.data)
      return
    }

    // Validate message structure
    if (!parsedData.type || typeof parsedData.type !== 'string') {
      console.error("@@INVALID MESSAGE TYPE", parsedData)
      return
    }

    switch (parsedData.type) {
      case "MESSAGE_SYNC_RESPONSE":
        await this.onMessageSync(parsedData.data)
        break
      case "CREATE_CONVERSATION_RESPONSE":
        await this.onConversationSync(parsedData.data)
        break
      case "PONG":
        // Heartbeat response - connection is alive
        break
      default:
        console.log("@@UNKNOWN MESSAGE TYPE:", parsedData.type)
        break
    }
  }

  private sendSocket({ type, data, id }: { type: SocketType; data: any; id?: string }): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log("@@SOCKET NOT READY, QUEUEING MESSAGE")
      return false
    }

    // Rate limiting check
    if (this.activeSyncs.size >= config.maxConcurrentSyncs) {
      console.log("@@MAX CONCURRENT SYNCS REACHED")
      return false
    }

    try {
      console.log("@@SENDING SOCKET:", type, id)
      this.socket.send(JSON.stringify({ type, data }))

      if (id) {
        this.activeSyncs.add(id)
      }

      return true
    } catch (error) {
      console.error("@@ERROR SENDING SOCKET MESSAGE", error)
      return false
    }
  }

  private async updateMessageSyncStatus({
    messageId,
    conversationId,
    status
  }: {
    messageId: string
    conversationId: string
    status: SyncStatus
  }): Promise<boolean> {
    try {
      console.log("@@UPDATING MESSAGE STATUS", messageId, status, conversationId)

      await chatDB.transaction('rw', chatDB.conversations, async () => {
        await chatDB.conversations.where("id").equals(conversationId).modify((conversation) => {
          if (status !== "syncing") {
            conversation.syncStatus = status
          }

          conversation.messages = conversation.messages.map((msg) => {
            if (msg.id === messageId) {
              return {
                ...msg,
                syncStatus: status,
                lastSyncAttempt: Date.now()
              }
            }
            return msg
          })
        })
      })

      return true
    } catch (error) {
      console.error("@@ERROR UPDATING MESSAGE STATUS", messageId, status, conversationId, error)
      return false
    }
  }

  private async updateConversationSyncStatus(conversationId: string, status: SyncStatus): Promise<boolean> {
    try {
      await chatDB.transaction('rw', chatDB.conversations, async () => {
        await chatDB.conversations.where("id").equals(conversationId).modify({
          syncStatus: status,
          lastSyncAttempt: Date.now()
        })
      })
      return true
    } catch (error) {
      console.error("@@ERROR UPDATING CONVERSATION STATUS", conversationId, status, error)
      return false
    }
  }

  private async onMessageSync(data: any) {
    if (!data?.id || !data?.conversationId) {
      console.error("@@INVALID MESSAGE SYNC DATA", data)
      return
    }

    const success = await this.updateMessageSyncStatus({
      messageId: data.id,
      conversationId: data.conversationId,
      status: data.status || "synced"
    })

    if (success) {
      this.retryQueue.delete(data.id)
      this.activeSyncs.delete(data.id)
    }
  }

  private async onConversationSync(data: any) {
    if (!data?.id) {
      console.error("@@INVALID CONVERSATION SYNC DATA", data)
      return
    }

    try {
      console.log("@@CONVERSATION SYNC RESPONSE", data)
      const success = await this.updateConversationSyncStatus(data.id, "synced")

      if (success) {
        this.retryQueue.delete(data.id)
        this.activeSyncs.delete(data.id)
      }
    } catch (error) {
      console.error("@@ERROR SYNCING CONVERSATION", data, error)
    }
  }

  private calculateRetryDelay(retryCount: number): number {
    const delay = Math.min(
      config.baseRetryDelay * Math.pow(2, retryCount),
      config.maxRetryDelay
    )
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000
  }

  private addToRetryQueue(item: SyncItem) {
    if (item.retryCount >= config.maxRetries) {
      console.log("@@MAX RETRIES REACHED FOR", item.id)

      if (item.type === 'message') {
        this.updateMessageSyncStatus({
          messageId: item.id,
          conversationId: item.conversationId,
          status: "error"
        })
      } else {
        this.updateConversationSyncStatus(item.id, "error")
      }
      return
    }

    this.retryQueue.set(item.id, {
      ...item,
      retryCount: item.retryCount + 1,
      lastAttempt: Date.now()
    })
  }

  private async processRetryQueue() {
    if (this.connectionState !== "connected") return

    const now = Date.now()
    const itemsToRetry: SyncItem[] = []

    for (const [id, item] of this.retryQueue) {
      const retryDelay = this.calculateRetryDelay(item.retryCount)

      if (now - item.lastAttempt >= retryDelay) {
        itemsToRetry.push(item)
      }
    }

    for (const item of itemsToRetry) {
      await this.syncItem(item)
    }
  }

  private async syncItem(item: SyncItem): Promise<boolean> {
    if (this.activeSyncs.size >= config.maxConcurrentSyncs) {
      return false
    }

    let success = false

    if (item.type === 'conversation') {
      success = this.sendSocket({
        type: "CREATE_CONVERSATION_REQUEST",
        data: item.data,
        id: item.id
      })
    } else if (item.type === 'message') {
      await this.updateMessageSyncStatus({
        messageId: item.id,
        conversationId: item.conversationId,
        status: "syncing"
      })

      success = this.sendSocket({
        type: "MESSAGE_SYNC_REQUEST",
        data: { ...item.data, conversationId: item.conversationId },
        id: item.id
      })
    }

    if (!success) {
      this.addToRetryQueue(item)
    } else {
      this.retryQueue.delete(item.id)
    }

    return success
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.connectionState === "connected") {
        this.sendSocket({ type: "HEARTBEAT", data: { timestamp: Date.now() } })
      }
    }, config.heartbeatInterval)
  }

  private handleDisconnection() {
    this.connectionState = "disconnected"
    this.clearTimers()
    this.activeSyncs.clear()

    if (!this.isShuttingDown) {
      this.scheduleReconnect()
    }
  }

  private handleConnectionError() {
    this.connectionState = "disconnected"
    this.clearTimers()
    this.activeSyncs.clear()

    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    if (!this.isShuttingDown) {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.isShuttingDown) return

    this.connectionState = "reconnecting"
    const delay = this.calculateRetryDelay(1)

    console.log(`@@SCHEDULING RECONNECT IN ${delay}ms`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.initializeConnection()
    }, delay)
  }

  private clearTimers() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.clearConnectionTimeout()
  }

  private clearConnectionTimeout() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }
  }

  private setupObservable() {
    this.observable = liveQuery(async () => {
      try {
        const [newConversations, pendingConversations, erroredConversations] = await Promise.all([
          chatDB.conversations.where("syncStatus").equals("new").toArray(),
          chatDB.conversations.where("syncStatus").equals("pending").toArray(),
          chatDB.conversations.where("syncStatus").equals("error").toArray()
        ])

        return {
          newConversations,
          pendingConversations,
          erroredConversations
        }
      } catch (error) {
        console.error("@@ERROR QUERYING DATABASE", error)
        return {
          newConversations: [],
          pendingConversations: [],
          erroredConversations: []
        }
      }
    })

    this.observable.subscribe({
      next: async (result: any) => {
        if (this.isShuttingDown) return

        try {
          await this.handleDatabaseChanges(result)
        } catch (error) {
          console.error("@@ERROR HANDLING DATABASE CHANGES", error)
        }
      },
      error: (error: any) => {
        console.error("@@OBSERVABLE ERROR", error)
      }
    })
  }

  private async handleDatabaseChanges(result: any) {
    // Process new conversations
    for (const conversation of result.newConversations || []) {
      const syncItem: SyncItem = {
        id: conversation.id,
        conversationId: conversation.id,
        type: 'conversation',
        data: conversation,
        retryCount: 0,
        lastAttempt: 0
      }

      await this.syncItem(syncItem)
    }

    // Process pending conversations and their messages
    for (const conversation of result.pendingConversations || []) {
      const unsyncedMessages = conversation.messages?.filter(
        (msg: any) => msg.syncStatus === "pending"
      ) || []

      for (const message of unsyncedMessages) {
        const syncItem: SyncItem = {
          id: message.id,
          conversationId: conversation.id,
          type: 'message',
          data: message,
          retryCount: 0,
          lastAttempt: 0
        }

        await this.syncItem(syncItem)
      }
    }

    // Process errored conversations and retry with backoff
    for (const conversation of result.erroredConversations || []) {
      const erroredMessages = conversation.messages?.filter(
        (msg: any) => msg.syncStatus === "error"
      ) || []

      for (const message of erroredMessages) {
        const existingItem = this.retryQueue.get(message.id)
        const syncItem: SyncItem = {
          id: message.id,
          conversationId: conversation.id,
          type: 'message',
          data: message,
          retryCount: existingItem?.retryCount || 0,
          lastAttempt: existingItem?.lastAttempt || 0
        }

        this.addToRetryQueue(syncItem)
      }
    }

    // Process retry queue periodically
    setTimeout(() => this.processRetryQueue(), 1000)
  }

  // Public methods for lifecycle management
  public getConnectionState(): ConnectionState {
    return this.connectionState
  }

  public getQueueSize(): number {
    return this.retryQueue.size
  }

  public getActiveSyncs(): number {
    return this.activeSyncs.size
  }

  public async shutdown(): Promise<void> {
    console.log("@@SHUTTING DOWN WEBSOCKET MANAGER")
    this.isShuttingDown = true

    this.clearTimers()

    if (this.observable) {
      this.observable.unsubscribe()
      this.observable = null
    }

    if (this.socket) {
      this.socket.close(1000, "Shutting down")
      this.socket = null
    }

    this.retryQueue.clear()
    this.activeSyncs.clear()
  }

  public forceReconnect(): void {
    console.log("@@FORCING RECONNECT")
    this.handleConnectionError()
  }
}

// Global instance and cleanup
let syncManager: WebSocketSyncManager | null = null

// Initialize the sync manager
function initializeSyncManager() {
  if (!syncManager) {
    syncManager = new WebSocketSyncManager()
  }
  return syncManager
}

// Cleanup on worker termination
self.addEventListener('beforeunload', async () => {
  if (syncManager) {
    await syncManager.shutdown()
  }
})

// Handle worker messages for manual control
self.addEventListener('message', async (event) => {
  const { type, data } = event.data

  switch (type) {
    case 'SHUTDOWN':
      if (syncManager) {
        await syncManager.shutdown()
        syncManager = null
      }
      break
    case 'RECONNECT':
      if (syncManager) {
        syncManager.forceReconnect()
      }
      break
    case 'STATUS':
      if (syncManager) {
        self.postMessage({
          type: 'STATUS_RESPONSE',
          data: {
            connectionState: syncManager.getConnectionState(),
            queueSize: syncManager.getQueueSize(),
            activeSyncs: syncManager.getActiveSyncs()
          }
        })
      }
      break
  }
})

// Start the sync manager
const manager = initializeSyncManager()

export { initializeSyncManager, syncManager }
