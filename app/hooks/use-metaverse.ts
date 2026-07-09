import { useCallback, useEffect, useRef, useState } from 'react'
import type { Peer, PlayerState, ChatMessage, ServerMessage, ClientMessage } from '../../shared/types/realtime'

export interface RemotePlayer extends PlayerState {
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
  sendVoice: (data: string, duration: number) => void
  sendName: (name: string) => void
}

const RECONNECT_DELAY = 5_000
const HEARTBEAT_INTERVAL = 25_000
const PONG_TIMEOUT = 10_000

export function useMetaverse(placeId: string): UseMetaverse {
  const [status, setStatus] = useState<UseMetaverse['status']>('connecting')
  const [self, setSelf] = useState<Peer | null>(null)
  const [players, setPlayers] = useState<RemotePlayer[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const playersRef = useRef(new Map<string, RemotePlayer>())
  const selfRef = useRef<Peer | null>(null)

  // Epoch counter: incremented on every connect(), so stale-socket event
  // handlers from a React Strict Mode double-invoke are silently ignored.
  const epochRef = useRef(0)

  const sendMoveRef = useRef<(x: number, y: number, z: number, rotation: number) => void>(() => {})
  const sendChatRef = useRef<(text: string) => void>(() => {})
  const sendVoiceRef = useRef<(data: string, duration: number) => void>(() => {})
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

  const sendVoice = useCallback((data: string, duration: number) => {
    sendVoiceRef.current(data, duration)
  }, [])

  const sendNameRef = useRef<(name: string) => void>(() => {})

  const sendName = useCallback((name: string) => {
    sendNameRef.current(name)
  }, [])

  useEffect(() => {
    const placeIdStr = placeId

    let heartbeatTimer: ReturnType<typeof setInterval> | undefined
    let pongTimer: ReturnType<typeof setTimeout> | undefined
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let socket: WebSocket | null = null

    function send(msg: ClientMessage) {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(msg))
      }
    }

    function startHeartbeat() {
      stopHeartbeat()
      heartbeatTimer = setInterval(() => {
        send({ t: 'ping' })
        pongTimer ??= setTimeout(() => socket?.close(), PONG_TIMEOUT)
      }, HEARTBEAT_INTERVAL)
    }

    function stopHeartbeat() {
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = undefined }
      if (pongTimer) { clearTimeout(pongTimer); pongTimer = undefined }
    }

    function handle(msg: ServerMessage) {
      switch (msg.t) {
        case 'welcome': {
          // Apply saved nickname from localStorage
          const saved = localStorage.getItem('lambobo-nickname');
          if (saved && saved !== msg.self.name) {
            msg.self.name = saved;
            setTimeout(() => send({ t: 'rename', name: saved }), 100);
          }
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
            syncPlayers()
          }
          break
        }
        case 'chat':
        case 'voice': {
          setMessages(prev => [...prev.slice(-99), msg.message])
          break
        }
        case 'rename': {
          const p = playersRef.current.get(msg.id)
          if (p) p.name = msg.name
          if (msg.id === selfRef.current?.id) {
            selfRef.current.name = msg.name
            setSelf({ ...selfRef.current })
          }
          syncPlayers()
          break
        }
        case 'pong':
          if (pongTimer) { clearTimeout(pongTimer); pongTimer = undefined }
          break
      }
    }

    function connect() {
      if (socket) {
        socket.close()
        socket = null
      }

      const epoch = ++epochRef.current
      setStatus('connecting')

      const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${protocol}://${location.host}/api/ws`)
      socket = ws

      ws.addEventListener('open', () => {
        if (epochRef.current !== epoch) return
        setStatus('connected')
        send({ t: 'join', placeId: placeIdStr })
        startHeartbeat()
      })

      ws.addEventListener('message', (event) => {
        if (epochRef.current !== epoch) return
        try { handle(JSON.parse(event.data) as ServerMessage) } catch { /* ignore */ }
      })

      ws.addEventListener('close', () => {
        if (epochRef.current !== epoch) return
        stopHeartbeat()
        if (epochRef.current !== epoch) return
        setStatus('disconnected')
        selfRef.current = null
        setSelf(null)
        playersRef.current = new Map()
        syncPlayers()
        reconnectTimer = setTimeout(() => {
          if (epochRef.current === epoch) connect()
        }, RECONNECT_DELAY)
      })

      ws.addEventListener('error', () => {
        if (epochRef.current !== epoch) return
        ws.close()
      })
    }

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

    sendVoiceRef.current = (data: string, duration: number) => {
      send({ t: 'voice', data, duration })
    }

    sendNameRef.current = (name: string) => {
      localStorage.setItem('lambobo-nickname', name);
      send({ t: 'rename', name })
    }

    connect()

    return () => {
      ++epochRef.current
      stopHeartbeat()
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      if (socket) {
        socket.close()
        socket = null
      }
    }
  }, [placeId])

  return { status, self, players, messages, sendMove, sendChat, sendVoice, sendName }
}
