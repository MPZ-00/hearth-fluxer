import { MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js'
import { initObserverCache } from '../bot/observerCache'
import { drainKickQueue } from '../services/kickQueue'
import { db } from '../db/client'
import { kickQueue } from '../db/schema'
import { config } from '../config'

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) {
        await interaction.reply({
            content: 'This command only works in a server.',
            flags: MessageFlags.Ephemeral,
        })
        return
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
            content: 'Administrator permission required.',
            flags: MessageFlags.Ephemeral,
        })
        return
    }

    const sub = interaction.options.getSubcommand()

    if (sub === 'observers-refresh') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        await initObserverCache(interaction.client, config.OBSERVER_GUILD_ID, config.OBSERVER_ROLE)
        await interaction.editReply(`Observer cache refreshed (role: "${config.OBSERVER_ROLE}").`)
        return
    }

    if (sub === 'queue-status') {
        const pending = db.select().from(kickQueue).all()
        if (pending.length === 0) {
            await interaction.reply({
                content: 'Kick queue is empty.',
                flags: MessageFlags.Ephemeral,
            })
            return
        }
        const lines = pending.map(
            (e) => `• <@${e.userId}> ─ queued <t:${e.queuedAt}:R>, ${e.attempts} attempt(s)`,
        )
        await interaction.reply({
            content: `**Kick queue** (${pending.length}):\n${lines.join('\n')}`,
            flags: MessageFlags.Ephemeral,
        })
        return
    }

    if (sub === 'queue-drain') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        const result = await drainKickQueue(interaction.client)
        await interaction.editReply(
            `Kick queue drained: ${result.success} succeeded, ${result.failed} still pending.`,
        )
        return
    }
}
