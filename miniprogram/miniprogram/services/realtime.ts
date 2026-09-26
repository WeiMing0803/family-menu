import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  IHttpConnectionOptions,
  LogLevel
} from '@microsoft/signalr'
import { API_BASE_URL, STORAGE_KEYS } from './config'

export type RealtimeEvent = 'DishChanged' | 'OrderChanged'
type RealtimeListener = () => void

interface MiniProgramSocketMessage {
  data: string | ArrayBuffer
}

interface MiniProgramSocketClose {
  code: number
  reason: string
  wasClean: boolean
}

interface MiniProgramWebSocketLike {
  binaryType: string
  readyState: number
  onopen: ((event: unknown) => void) | null
  onmessage: ((event: MiniProgramSocketMessage) => void) | null
  onerror: ((event: unknown) => void) | null
  onclose: ((event: MiniProgramSocketClose) => void) | null
  send(data: string | ArrayBuffer): void
  close(code?: number, reason?: string): void
}

interface MiniProgramWebSocketConstructor {
  new(url: string, protocols?: string | string[], options?: unknown): MiniProgramWebSocketLike
  readonly CLOSED: number
  readonly CLOSING: number
  readonly CONNECTING: number
  readonly OPEN: number
}

class MiniProgramWebSocket implements MiniProgramWebSocketLike {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  binaryType = 'arraybuffer'
  readyState = MiniProgramWebSocket.CONNECTING
  onopen: MiniProgramWebSocketLike['onopen'] = null
  onmessage: MiniProgramWebSocketLike['onmessage'] = null
  onerror: MiniProgramWebSocketLike['onerror'] = null
  onclose: MiniProgramWebSocketLike['onclose'] = null

  private readonly socketTask: WechatMiniprogram.SocketTask

  constructor(url: string, protocols?: string | string[]) {
    const socketOptions: WechatMiniprogram.ConnectSocketOption = { url }
    if (protocols) {
      socketOptions.protocols = typeof protocols === 'string' ? [protocols] : protocols
    }
    socketOptions.fail = (error) => this.handleError(error)

    this.socketTask = wx.connectSocket(socketOptions)
    this.socketTask.onOpen((event) => {
      if (this.readyState !== MiniProgramWebSocket.CONNECTING) return
      this.readyState = MiniProgramWebSocket.OPEN
      this.onopen?.(event)
    })
    this.socketTask.onMessage((event) => this.onmessage?.({ data: event.data }))
    this.socketTask.onError((error) => this.handleError(error))
    this.socketTask.onClose((event) => {
      this.handleClose({
        code: event.code,
        reason: event.reason,
        wasClean: event.code === 1000
      })
    })
  }

  send(data: string | ArrayBuffer): void {
    this.socketTask.send({
      data,
      fail: (error) => this.handleError(error)
    })
  }

  close(code?: number, reason?: string): void {
    if (this.readyState >= MiniProgramWebSocket.CLOSING) return
    this.readyState = MiniProgramWebSocket.CLOSING
    this.socketTask.close({ code, reason })
  }

  private handleError(error: unknown): void {
    this.onerror?.(error)
    const reason = typeof error === 'object' && error !== null && 'errMsg' in error
      ? String((error as { errMsg?: unknown }).errMsg ?? '')
      : ''
    this.handleClose({ code: 1006, reason, wasClean: false })
  }

  private handleClose(event: MiniProgramSocketClose): void {
    if (this.readyState === MiniProgramWebSocket.CLOSED) return
    this.readyState = MiniProgramWebSocket.CLOSED
    this.onclose?.(event)
  }
}

const listeners: Record<RealtimeEvent, Set<RealtimeListener>> = {
  DishChanged: new Set<RealtimeListener>(),
  OrderChanged: new Set<RealtimeListener>()
}

let connection: HubConnection | null = null
let startPromise: Promise<void> | null = null
let shouldConnect = false
let retryTimer: number | null = null
let initialRetryCount = 0

function getToken(): string {
  return wx.getStorageSync(STORAGE_KEYS.token) as string || ''
}

function getHubUrl(): string {
  const apiRoot = API_BASE_URL.replace(/\/api\/?$/i, '')
  const websocketRoot = apiRoot.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:')
  return `${websocketRoot}/hubs/family`
}

function notify(event: RealtimeEvent): void {
  for (const listener of Array.from(listeners[event])) {
    try {
      listener()
    } catch {
      // A page refresh handler must not prevent other subscribers from receiving the event.
    }
  }
}

function createConnection(): HubConnection {
  const options: IHttpConnectionOptions & { WebSocket: MiniProgramWebSocketConstructor } = {
    accessTokenFactory: getToken,
    transport: HttpTransportType.WebSockets,
    skipNegotiation: true,
    withCredentials: false,
    WebSocket: MiniProgramWebSocket as unknown as MiniProgramWebSocketConstructor
  }
  const hub = new HubConnectionBuilder()
    .withUrl(getHubUrl(), options)
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: (context) =>
        Math.min(1000 * 2 ** context.previousRetryCount, 30000)
    })
    .configureLogging(LogLevel.Warning)
    .build()

  hub.on('DishChanged', () => notify('DishChanged'))
  hub.on('OrderChanged', () => notify('OrderChanged'))
  hub.onreconnected(() => {
    initialRetryCount = 0
    // Refresh snapshots after reconnect so changes sent while offline are not missed.
    notify('DishChanged')
    notify('OrderChanged')
  })
  hub.onclose(() => scheduleInitialRetry())
  return hub
}

function scheduleInitialRetry(): void {
  if (!shouldConnect || retryTimer !== null) return
  const delay = Math.min(1000 * 2 ** initialRetryCount, 30000)
  initialRetryCount += 1
  retryTimer = setTimeout(() => {
    retryTimer = null
    void ensureConnected()
  }, delay)
}

function ensureConnected(): Promise<void> {
  if (!shouldConnect || !getToken()) return Promise.resolve()
  if (!connection) connection = createConnection()
  if (connection.state !== HubConnectionState.Disconnected) return Promise.resolve()
  if (startPromise) return startPromise

  startPromise = connection.start()
    .then(() => {
      initialRetryCount = 0
    })
    .catch(() => {
      scheduleInitialRetry()
    })
    .finally(() => {
      startPromise = null
    })
  return startPromise
}

export function startRealtime(): void {
  if (!getToken()) {
    void stopRealtime()
    return
  }
  shouldConnect = true
  void ensureConnected()
}

export async function stopRealtime(): Promise<void> {
  shouldConnect = false
  initialRetryCount = 0
  if (retryTimer !== null) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  if (connection && connection.state !== HubConnectionState.Disconnected) {
    await connection.stop()
  }
}

export function subscribeRealtime(event: RealtimeEvent, listener: RealtimeListener): () => void {
  listeners[event].add(listener)
  return () => listeners[event].delete(listener)
}
