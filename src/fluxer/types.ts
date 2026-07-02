// Field names verified against fluxerapp/fluxer source (packages/schema) as of the port date.
// See ../../PORTING.md for what's confirmed vs assumed.

export interface FluxerUser {
    id: string
    username: string
    discriminator: string
    global_name: string | null
    avatar: string | null
    bot?: boolean
}

export interface FluxerGuildMember {
    user: FluxerUser
    nick: string | null
    roles: string[] // role IDs, not names
    joined_at: string
}

export interface FluxerGuildInvite {
    code: string
    type: number
    guild: { id: string }
    channel: { id: string }
    uses?: number
    max_uses?: number
    max_age?: number
    temporary: boolean
    expires_at: string | null
    created_at?: string
}

export interface CreateChannelInviteBody {
    max_uses?: number
    max_age?: number
    unique?: boolean
    temporary?: boolean
}

export interface GatewayBotInfo {
    url: string
    shards?: number
}

// Confirmed exact strings: fluxer_api/src/api/constants/Gateway.ts
export type GatewayDispatchEvent =
    | 'READY'
    | 'RESUMED'
    | 'PRESENCE_UPDATE'
    | 'GUILD_CREATE'
    | 'GUILD_UPDATE'
    | 'GUILD_DELETE'
    | 'GUILD_MEMBER_ADD'
    | 'GUILD_MEMBER_UPDATE'
    | 'GUILD_MEMBER_REMOVE'
    | 'GUILD_ROLE_CREATE'
    | 'GUILD_ROLE_UPDATE'
    | 'GUILD_ROLE_DELETE'
    | 'MESSAGE_CREATE'
    | 'INVITE_CREATE'
    | 'INVITE_DELETE'

// Confirmed exact values: packages/constants/src/GatewayConstants.ts
export const GatewayOpcodes = {
    DISPATCH: 0,
    HEARTBEAT: 1,
    IDENTIFY: 2,
    PRESENCE_UPDATE: 3,
    VOICE_STATE_UPDATE: 4,
    RESUME: 6,
    RECONNECT: 7,
    REQUEST_GUILD_MEMBERS: 8,
    INVALID_SESSION: 9,
    HELLO: 10,
    HEARTBEAT_ACK: 11,
} as const

export interface GatewayPayload<T = unknown> {
    op: number
    d: T
    s?: number | null
    t?: GatewayDispatchEvent | null
}

// Dispatch payload shapes below are ASSUMED Discord-parity (unverified field-by-field).
// Confirm against a live gateway connection before relying on them.

export interface ReadyDispatch {
    user: FluxerUser
    session_id: string
}

export interface GuildDispatch {
    id: string
}

export interface GuildMemberAddDispatch extends FluxerGuildMember {
    guild_id: string
}

export interface GuildMemberRemoveDispatch {
    guild_id: string
    user: FluxerUser
}

export interface PresenceUpdateDispatch {
    user: { id: string }
    guild_id?: string
    status: 'online' | 'idle' | 'dnd' | 'offline'
}

export interface InviteCreateDispatch {
    guild_id?: string
    channel_id: string
    code: string
}

export interface InviteDeleteDispatch {
    guild_id?: string
    channel_id: string
    code: string
}
