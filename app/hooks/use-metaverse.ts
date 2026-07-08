import { useCallback, useEffect, useRef, useState } from 'react'
import type { Peer, PlayerState, ChatMessage, ServerMessage, ClientMessage } from '../../shared/types/realtime'

export interface RemotePlayer extends PlayerState {
  /** Smoothing target. */
  targetX: number
  targetY: number
  targetZ: number
  targetRotation: number
}

export interface UseMetaverse {
  status: 'connecting' | 'connected' | 'disconnected'
  self: Peer | null
  players: RemotePlayer[]
  messages: ChatMessage[]
  sendMove: (x: number, y: number, z: number, rotation: number) => void
  sendChat: (text: string) => void
}

const HEARTBEAT_INTERVAL = 25_000
const PONG_TIMEOUT = 10_000

export function useMetaverse(placeId: string): UseMetaverse {
  const [status, setStatus] = useState<UseMetaverse['status']>('connecting')
  const [self, setSelf] = useState<Peer | null>(null)
  const [players, setPlayers] = useState<RemotePlayer[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const playersRef = useRef(new Map<string, RemotePlayer>())
  const selfRef = useRef<Peer | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const closedRef = useRef(false)
  const reconnectDelayRef = useRef(1000)

  // Outgoing state
  const sendMoveRef = useRef<(x: number, y: number, z: number, rotation: number) => void>(() => {})
  const sendChatRef = useRef<(text: string) => void>(() => {})
  const pendingMoveRef = useRef<{ x: number; y: number; z: number; rotation: number } | null>(null)
  const rafRef = useRef<number | undefined>(undefined)

  function syncPlayers() {
    setPlayers([...playersRef.current.values()])
  }

  const sendMove = useCallback((x: number, y: number, z: number, rotation: number) => {
    sendMoveRef.current(x, y, z, rotation)
  }, [])

  const sendChat = useCallback((text: string) => {
    sendChatRef.current(text)
  }, [])

  useEffect(() => {
    const placeIdStr = placeId
    closedRef.current = false
    reconnectDelayRef.current = 1000

    let heartbeatTimer: ReturnType<typeof setInterval> | undefined
    let pongTimer: ReturnType<typeof setTimeout> | undefined

    function send(msg: ClientMessage) {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(msg))
      }
    }

    function startHeartbeat() {
      stopHeartbeat()
      heartbeatTimer = setInterval(() => {
        send({ t: 'ping' })
        pongTimer ??= setTimeout(() => socketRef.current?.close(), PONG_TIMEOUT)
      }, HEARTBEAT_INTERVAL)
    }

    function stopHeartbeat() {
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = undefined }
      if (pongTimer) { clearTimeout(pongTimer); pongTimer = undefined }
    }

    function handle(msg: ServerMessage) {
      switch (msg.t) {
        case 'welcome': {
          selfRef.current = msg.self
          setSelf(msg.self)
          const map = new Map<string, RemotePlayer>()
          for (const p of msg.peers) {
            map.set(p.id, { ...p, targetX: p.x, targetY: p.y, targetZ: p.z, targetRotation: p.rotation })
          }
          playersRef.current = map
          syncPlayers()
          break
        }
        case 'join': {
          const p = msg.peer
          playersRef.current.set(p.id, { ...p, targetX: p.x, targetY: p.y, targetZ: p.z, targetRotation: p.rotation })
          syncPlayers()
          break
        }
        case 'leave': {
          if (playersRef.current.delete(msg.id)) syncPlayers()
          break
        }
        case 'move': {
          const p = playersRef.current.get(msg.id)
          if (p) {
            p.targetX = msg.x
            p.targetY = msg.y
            p.targetZ = msg.z
            p.targetRotation = msg.rotation
          }
          break
        }
        case 'chat': {
          setMessages(prev => [...prev.slice(-99), msg.message])
          break
        }
        case 'pong':
          if (pongTimer) { clearTimeout(pongTimer); pongTimer = undefined }
          break
      }
    }

    function connect() {
      if (closedRef.current) return
      setStatus('connecting')

      const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${protocol}://${location.host}/api/ws`)
      socketRef.current = ws

      ws.addEventListener('open', () => {
        reconnectDelayRef.current = 1000
        setStatus('connected')
        send({ t: 'join', placeId: placeIdStr })
        startHeartbeat()
      })

      ws.addEventListener('message', (event) => {
        try { handle(JSON.parse(event.data) as ServerMessage) } catch { /* ignore */ }
      })

      ws.addEventListener('close', () => {
        stopHeartbeat()
        if (closedRef.current) return
        setStatus('disconnected')
        selfRef.current = null
        setSelf(null)
        playersRef.current = new Map()
        syncPlayers()
        const delay = reconnectDelayRef.current
        setTimeout(connect, delay)
        reconnectDelayRef.current = Math.min(delay * 2, 30_000)
      })

      ws.addEventListener('error', () => ws.close())
    }

    // Throttled move sends
    sendMoveRef.current = (x, y, z, rotation) => {
      pendingMoveRef.current = { x, y, z, rotation }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = undefined
          const m = pendingMoveRef.current
          if (m) {
            send({ t: 'move', ...m })
            pendingMoveRef.current = null
          }
        })
      }
    }

    sendChatRef.current = (text: string) => {
      send({ t: 'chat', text })
    }

    connect()

    return () => {
      closedRef.current = true
      stopHeartbeat()
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      socketRef.current?.close()
    }
  }, [placeId])

  return { status, self, players, messages, sendMove, sendChat }
}
