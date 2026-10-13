import { type ParameterSpec } from './parameters.js'

export interface NudgeRequest {
	/** Last value the switcher reported, in protocol units. */
	reportedProtocol: number | undefined
	/** Value we already sent and have not yet seen echoed. User units. */
	pendingUser: number | undefined
	/** `increase`, `decrease`, or `encoder`. */
	direction: string
	/** Signed detent count. Used only when direction is `encoder`. */
	ticks: number
	/** `fine`, `coarse`, or `custom`. */
	speed: string
	customStep: number
	spec: ParameterSpec
}

export interface NudgeResult {
	user: number
	protocol: number
}

export function roundUser(value: number): number {
	return Math.round(value * 10000) / 10000
}

export function clamp(min: number, max: number, value: number): number {
	return Math.min(max, Math.max(min, value))
}

export function protocolLimits(spec: ParameterSpec): { min: number; max: number } {
	return {
		min: Math.round(spec.min * spec.scale),
		max: Math.round(spec.max * spec.scale),
	}
}

export function userToProtocol(spec: ParameterSpec, user: number): number {
	const limits = protocolLimits(spec)
	return clamp(limits.min, limits.max, Math.round(user * spec.scale))
}

export function protocolToUser(spec: ParameterSpec, protocol: number): number {
	return roundUser(protocol / spec.scale)
}

export function formatUser(spec: ParameterSpec, user: number): string {
	const rounded = roundUser(user)
	const fixed = rounded.toFixed(spec.decimals)
	if (Math.abs(Number(fixed) - rounded) < 0.00005) return fixed
	return String(rounded)
}

export function stepForSpeed(spec: ParameterSpec, speed: string, customStep: number): number {
	if (speed === 'coarse') return spec.coarse
	if (speed === 'custom') return customStep
	return spec.fine
}

/** Positive is up / clockwise. Zero means this call should not change the value. */
export function signedTicks(direction: string, ticks: number): number {
	if (direction === 'decrease') return -1
	if (direction === 'increase') return 1
	if (!Number.isFinite(ticks) || ticks === 0) return 0
	return ticks
}

function wrapUser(spec: ParameterSpec, user: number): number {
	const span = spec.wrapModulo ?? spec.max - spec.min
	if (!(span > 0)) return spec.min
	let offset = user - spec.min
	offset = ((offset % span) + span) % span
	return roundUser(spec.min + offset)
}

/**
 * Add a fine or coarse step to the current value.
 * Pending wins over the switcher's last report so a quick series of encoder
 * clicks does not all start from the same number.
 * A step smaller than one protocol unit still moves one unit, so a turn is never a no-op
 * until the value is hard against a stop.
 */
export function applyNudge(request: NudgeRequest): NudgeResult | undefined {
	const ticks = signedTicks(request.direction, request.ticks)
	const step = stepForSpeed(request.spec, request.speed, request.customStep)
	if (ticks === 0 || !Number.isFinite(step) || step === 0) return undefined

	const reportedUser =
		request.reportedProtocol === undefined || !Number.isFinite(request.reportedProtocol)
			? undefined
			: protocolToUser(request.spec, request.reportedProtocol)
	const base = request.pendingUser ?? reportedUser
	if (base === undefined || !Number.isFinite(base)) return undefined

	const delta = ticks * step
	let user = roundUser(base + delta)
	if (request.spec.wrap) user = wrapUser(request.spec, user)
	else user = clamp(request.spec.min, request.spec.max, user)

	let protocol = userToProtocol(request.spec, user)
	const baseProtocol = userToProtocol(request.spec, base)
	if (protocol === baseProtocol) {
		const limits = protocolLimits(request.spec)
		const bumped = clamp(limits.min, limits.max, baseProtocol + (delta > 0 ? 1 : -1))
		if (bumped === baseProtocol) return undefined
		protocol = bumped
		user = protocolToUser(request.spec, protocol)
		if (request.spec.wrap) user = wrapUser(request.spec, user)
	}

	return { user, protocol }
}
