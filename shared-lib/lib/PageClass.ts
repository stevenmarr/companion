const HOST_KEYS = ['host', 'ip', 'address', 'hostname', 'target', 'camera_ip', 'cameraIp', 'host_address'] as const

/**
 * Write a new camera address into the connection config field the module already uses.
 * A blank address leaves the copied settings alone. Returns `applied: false` when an address was
 * given but the config has no host, IP, or address field to put it in.
 */
export function applyHostOverride(config: unknown, host: string | undefined): { config: unknown; applied: boolean } {
	const trimmed = host?.trim() ?? ''
	if (!trimmed) return { config, applied: true }
	if (!config || typeof config !== 'object' || Array.isArray(config)) return { config, applied: false }

	const record = config as Record<string, unknown>
	const known = HOST_KEYS.find((key) => typeof record[key] === 'string')
	const key =
		known ??
		Object.keys(record).find(
			(candidate) => typeof record[candidate] === 'string' && /host|ip|address|hostname|target/i.test(candidate)
		)
	if (!key) return { config, applied: false }

	return { config: { ...record, [key]: trimmed }, applied: true }
}

/**
 * Next free connection label. `PTZ-1` becomes `PTZ-2`. A label with no trailing number becomes `Name-2`.
 */
export function suggestNextLabel(label: string, taken: ReadonlySet<string>): string {
	const match = /^(.*?)(\d+)$/.exec(label)
	const prefix = match ? match[1] : `${label}-`
	let n = match ? Number(match[2]) + 1 : 2
	let candidate = `${prefix}${n}`
	while (taken.has(candidate)) {
		n += 1
		candidate = `${prefix}${n}`
	}
	return candidate
}
