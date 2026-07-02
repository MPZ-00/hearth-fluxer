import { FluxerRest } from '../fluxer/rest'
import { FluxerGateway } from '../fluxer/gateway'
import { config } from '../config'
import { BOT_VERSION } from '../version'

export interface FluxerClient {
    rest: FluxerRest
    gateway: FluxerGateway
    userId: string | null
}

// No intents system on Fluxer (confirmed: no GatewayIntentBits anywhere in the repo).
// Member/presence events arrive unfiltered, so there's no privileged-intent approval step.
export async function createClient(): Promise<FluxerClient> {
    const rest = new FluxerRest(config.FLUXER_TOKEN, config.FLUXER_API_BASE_URL)
    const { url } = await rest.getGatewayBot()
    const gateway = new FluxerGateway(config.FLUXER_TOKEN, url)

    const client: FluxerClient = { rest, gateway, userId: null }

    gateway.onDispatch<{ user: { id: string } }>('READY', (d) => {
        client.userId = d.user.id
    })

    // Baked into IDENTIFY, so a flaky connection never reconnects with no activity at all.
    // Activity type numbers assumed Discord-parity (0 = Playing), unverified.
    gateway.setPresence({ name: BOT_VERSION, type: 0 })

    return client
}
