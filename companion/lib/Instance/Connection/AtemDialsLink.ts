import type { InstanceConfig } from '@companion-app/shared/Model/Instance.js'

export const ATEM_DIALS_MODULE_ID = 'pvllc-atem-dials'
export const ATEM_SWITCHER_MODULE_ID = 'bmd-atem'

const DEFAULT_ATEM_PORT = 9910

/**
 * Copy the selected Blackmagic ATEM connection's address into the dials config that is sent to the
 * module. The stored dials config only keeps the connection id. The address is filled in here so a
 * change of the switcher's IP is picked up without a second address field to validate.
 */
export function enrichAtemDialsConfig(
	config: InstanceConfig,
	lookup: (connectionId: string) => InstanceConfig | undefined
): InstanceConfig {
	if (config.moduleId !== ATEM_DIALS_MODULE_ID) return config

	const current = isRecord(config.config) ? { ...config.config } : {}
	const selected = typeof current.atemConnection === 'string' ? current.atemConnection : ''
	const other = selected ? lookup(selected) : undefined
	const address =
		other && other.moduleId === ATEM_SWITCHER_MODULE_ID && other.enabled !== false
			? readSwitcherAddress(other.config)
			: undefined

	current.host = address?.host ?? ''
	current.port = address?.port ?? DEFAULT_ATEM_PORT

	return { ...config, config: current }
}

export function readSwitcherAddress(config: unknown): { host: string; port: number } | undefined {
	if (!isRecord(config)) return undefined

	const bonjour = config.bonjourHost
	if (typeof bonjour === 'string' && bonjour.trim()) {
		const parsed = splitHostPort(bonjour.trim())
		if (parsed) return parsed
	}

	const host = typeof config.host === 'string' ? config.host.trim() : ''
	if (!host) return undefined
	return { host, port: DEFAULT_ATEM_PORT }
}

function splitHostPort(value: string): { host: string; port: number } | undefined {
	const colon = value.lastIndexOf(':')
	if (colon <= 0) return { host: value, port: DEFAULT_ATEM_PORT }

	const host = value.slice(0, colon).trim()
	const port = Number(value.slice(colon + 1))
	if (!host) return undefined
	if (!Number.isInteger(port) || port < 1 || port > 65535) return { host: value, port: DEFAULT_ATEM_PORT }
	return { host, port }
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}
