import { EventEmitter } from 'events'
import WebSocket from 'ws'
import { logger } from '../logger'
import { GatewayOpcodes, type GatewayDispatchEvent, type GatewayPayload } from './types'

interface ActivityPresence {
    name: string
    type: number
}

/**
 * Minimal gateway client. Opcode numbers and the IDENTIFY/RESUME/HEARTBEAT payload shapes
 * below are confirmed against fluxer_app's GatewaySocket.ts and packages/constants/GatewayConstants.ts.
 * There is no intents system on Fluxer (confirmed: no GatewayIntentBits anywhere in the repo),
 * bots receive events unfiltered, so IDENTIFY carries a `flags` bitfield instead of `intents`.
 */
export class FluxerGateway extends EventEmitter {
    private ws?: WebSocket
    private heartbeatInterval?: NodeJS.Timeout
    private lastSeq: number | null = null
    private sessionId: string | null = null
    private helloReceived = false
    private presence?: ActivityPresence

    constructor(
        private token: string,
        private gatewayUrl: string,
    ) {
        super()
    }

    setPresence(activity: ActivityPresence) {
        this.presence = activity
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.send(GatewayOpcodes.PRESENCE_UPDATE, {
                since: null,
                activities: [activity],
                status: 'online',
                afk: false,
            })
        }
    }

    connect(): void {
        this.helloReceived = false
        // Server closes with 4012 if ?v=1 is missing, see PORTING.md.
        this.ws = new WebSocket(`${this.gatewayUrl}?v=1&encoding=json`)

        this.ws.on('open', () => logger.debug('Fluxer gateway: connected'))
        this.ws.on('message', (raw) => this.handleMessage(raw.toString()))
        this.ws.on('close', (code) => {
            logger.warn(`Fluxer gateway: closed (${code})`)
            this.stopHeartbeat()
            this.emit('close', code)
            setTimeout(() => this.connect(), 2000)
        })
        this.ws.on('error', (err) => logger.error('Fluxer gateway error:', err))
    }

    private send(op: number, d: unknown) {
        this.ws?.send(JSON.stringify({ op, d }))
    }

    private handleMessage(raw: string) {
        const payload = JSON.parse(raw) as GatewayPayload
        if (payload.s != null) this.lastSeq = payload.s

        switch (payload.op) {
            case GatewayOpcodes.HELLO: {
                const { heartbeat_interval } = payload.d as {
                    heartbeat_interval: number
                }
                this.startHeartbeat(heartbeat_interval)
                if (!this.helloReceived && this.sessionId) {
                    this.sendResume()
                } else {
                    this.sendIdentify()
                }
                this.helloReceived = true
                break
            }
            case GatewayOpcodes.DISPATCH: {
                if (payload.t === 'READY') {
                    const d = payload.d as { session_id: string }
                    this.sessionId = d.session_id
                }
                if (payload.t) this.emit(payload.t, payload.d)
                break
            }
            case GatewayOpcodes.HEARTBEAT_ACK:
                break
            case GatewayOpcodes.HEARTBEAT:
                this.send(GatewayOpcodes.HEARTBEAT, this.lastSeq)
                break
            case GatewayOpcodes.RECONNECT:
                this.ws?.close()
                break
            case GatewayOpcodes.INVALID_SESSION:
                this.sessionId = null
                this.sendIdentify()
                break
            default:
                logger.debug(`Fluxer gateway: unhandled opcode ${payload.op}`)
        }
    }

    private sendIdentify() {
        this.send(GatewayOpcodes.IDENTIFY, {
            token: this.token,
            properties: {
                os: process.platform,
                browser: 'hearth-fluxer',
                device: 'hearth-fluxer',
            },
            ...(this.presence && {
                presence: {
                    activities: [this.presence],
                    status: 'online',
                    afk: false,
                },
            }),
            flags: 0,
        })
    }

    private sendResume() {
        this.send(GatewayOpcodes.RESUME, {
            token: this.token,
            session_id: this.sessionId,
            seq: this.lastSeq,
        })
    }

    private startHeartbeat(intervalMs: number) {
        this.stopHeartbeat()
        this.heartbeatInterval = setInterval(() => {
            this.send(GatewayOpcodes.HEARTBEAT, this.lastSeq)
        }, intervalMs)
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
    }

    onDispatch<T = unknown>(event: GatewayDispatchEvent, listener: (data: T) => void) {
        this.on(event, listener)
    }
}
