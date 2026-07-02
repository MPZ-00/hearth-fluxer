import type {
    CreateChannelInviteBody,
    CreateGuildChannelBody,
    CreateGuildRoleBody,
    FluxerChannel,
    FluxerGuild,
    FluxerGuildInvite,
    FluxerGuildMember,
    FluxerMessage,
    FluxerRole,
    FluxerUser,
    GatewayBotInfo,
    UpdateGuildRoleBody,
} from './types'

export class FluxerApiError extends Error {
    constructor(
        public status: number,
        public body: unknown,
    ) {
        super(`Fluxer API error ${status}: ${JSON.stringify(body)}`)
    }
}

/**
 * Thin REST wrapper. Route paths/fields marked "confirmed" were read directly out of
 * fluxerapp/fluxer source. The rest are Discord-parity guesses, see PORTING.md.
 */
export class FluxerRest {
    constructor(
        private token: string,
        private baseUrl: string,
    ) {}

    private async request<T>(
        method: string,
        path: string,
        opts: { body?: unknown; reason?: string } = {},
    ): Promise<T> {
        const headers: Record<string, string> = {
            Authorization: `Bot ${this.token}`,
        }
        if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
        if (opts.reason) headers['X-Audit-Log-Reason'] = opts.reason

        const res = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers,
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        })

        if (res.status === 204) return undefined as T
        const data = await res.json().catch(() => undefined)
        if (!res.ok) throw new FluxerApiError(res.status, data)
        return data as T
    }

    // confirmed: fluxer_api/src/api/gateway/GatewayController.ts
    getGatewayBot(): Promise<GatewayBotInfo> {
        return this.request('GET', '/gateway/bot')
    }

    // confirmed: fluxer_api/src/api/guild/controllers/GuildMemberController.ts
    listGuildMembers(guildId: string, opts: { limit?: number; after?: string } = {}) {
        const q = new URLSearchParams()
        if (opts.limit) q.set('limit', String(opts.limit))
        if (opts.after) q.set('after', opts.after)
        const qs = q.toString() ? `?${q}` : ''
        return this.request<FluxerGuildMember[]>('GET', `/guilds/${guildId}/members${qs}`)
    }

    // confirmed
    getGuildMember(guildId: string, userId: string) {
        return this.request<FluxerGuildMember>('GET', `/guilds/${guildId}/members/${userId}`)
    }

    async hasGuildMember(guildId: string, userId: string): Promise<boolean> {
        try {
            await this.getGuildMember(guildId, userId)
            return true
        } catch (err) {
            if (err instanceof FluxerApiError && err.status === 404) return false
            throw err
        }
    }

    // confirmed: DELETE requires kick_members permission, supports X-Audit-Log-Reason
    kickGuildMember(guildId: string, userId: string, reason?: string) {
        return this.request<void>('DELETE', `/guilds/${guildId}/members/${userId}`, { reason })
    }

    // confirmed: fluxer_api/src/api/invite/InviteController.ts
    createChannelInvite(channelId: string, body: CreateChannelInviteBody, reason?: string) {
        return this.request<FluxerGuildInvite>('POST', `/channels/${channelId}/invites`, {
            body,
            reason,
        })
    }

    // confirmed
    deleteInvite(code: string, reason?: string) {
        return this.request<void>('DELETE', `/invites/${code}`, { reason })
    }

    // ASSUMED (Discord-parity, unverified): guild invite listing endpoint
    listGuildInvites(guildId: string) {
        return this.request<FluxerGuildInvite[]>('GET', `/guilds/${guildId}/invites`)
    }

    // confirmed: fluxer_api/src/api/guild/controllers/GuildBaseController.ts
    getGuild(guildId: string) {
        return this.request<FluxerGuild>('GET', `/guilds/${guildId}`)
    }

    // confirmed: fluxer_api/src/api/guild/controllers/GuildRoleController.ts
    listGuildRoles(guildId: string) {
        return this.request<FluxerRole[]>('GET', `/guilds/${guildId}/roles`)
    }

    // confirmed
    createGuildRole(guildId: string, body: CreateGuildRoleBody) {
        return this.request<FluxerRole>('POST', `/guilds/${guildId}/roles`, { body })
    }

    // confirmed
    updateGuildRole(guildId: string, roleId: string, body: UpdateGuildRoleBody) {
        return this.request<FluxerRole>('PATCH', `/guilds/${guildId}/roles/${roleId}`, { body })
    }

    // confirmed: fluxer_api/src/api/guild/controllers/GuildChannelController.ts
    listGuildChannels(guildId: string) {
        return this.request<FluxerChannel[]>('GET', `/guilds/${guildId}/channels`)
    }

    // confirmed
    createGuildChannel(guildId: string, body: CreateGuildChannelBody) {
        return this.request<FluxerChannel>('POST', `/guilds/${guildId}/channels`, { body })
    }

    // confirmed: fluxer_api/src/api/guild/controllers/GuildMemberController.ts
    addGuildMemberRole(guildId: string, userId: string, roleId: string, reason?: string) {
        return this.request<void>('PUT', `/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
            reason,
        })
    }

    // confirmed: fluxer_api/src/api/channel/controllers/MessageInteractionController.ts
    listPinnedMessages(channelId: string) {
        return this.request<FluxerMessage[]>('GET', `/channels/${channelId}/messages/pins`)
    }

    // confirmed
    pinMessage(channelId: string, messageId: string) {
        return this.request<void>('PUT', `/channels/${channelId}/pins/${messageId}`)
    }

    // ASSUMED (Discord-parity, unverified): message edit endpoint
    editMessage(channelId: string, messageId: string, content: string) {
        return this.request<FluxerMessage>(
            'PATCH',
            `/channels/${channelId}/messages/${messageId}`,
            {
                body: { content },
            },
        )
    }

    // ASSUMED (Discord-parity, unverified)
    getUser(userId: string) {
        return this.request<FluxerUser>('GET', `/users/${userId}`)
    }

    // ASSUMED (Discord-parity, unverified): DM channel creation
    createDM(recipientId: string) {
        return this.request<{ id: string }>('POST', '/users/@me/channels', {
            body: { recipient_id: recipientId },
        })
    }

    // ASSUMED (Discord-parity, unverified): message send is proxied to fluxer_messages service
    sendMessage(channelId: string, content: string) {
        return this.request<FluxerMessage>('POST', `/channels/${channelId}/messages`, {
            body: { content },
        })
    }
}
