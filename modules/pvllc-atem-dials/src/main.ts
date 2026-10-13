import { Atem, VideoState, type AtemState } from 'atem-connection'
import {
	InstanceBase,
	InstanceStatus,
	Regex,
	type JsonObject,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { applyNudge, protocolToUser, userToProtocol } from './nudge.js'
import {
	MAX_KEYERS,
	MAX_MIX_EFFECTS,
	PARAMETERS,
	parameterById,
	variableId,
	type ParameterSpec,
} from './parameters.js'
import { buildPresetSections } from './presets.js'

interface ModuleConfig {
	host: string
	port: number
}

interface NudgeOptions {
	me: number
	keyer: number
	parameter: string
	speed: string
	customStep: number
	direction: string
	ticks: number
}

interface SetOptions {
	me: number
	keyer: number
	parameter: string
	value: number
}

type DialVariables = Record<string, number | string | undefined>

class AtemDialsInstance extends InstanceBase {
	#config: ModuleConfig = { host: '', port: 9910 }
	#atem: Atem | undefined
	/** User values already sent, until the switcher catches up. */
	#pending = new Map<string, number>()
	#published = new Map<string, number>()
	#releaseTimers = new Map<string, ReturnType<typeof setTimeout>>()
	#onAir = new Map<string, boolean>()
	#sendChain: Promise<void> = Promise.resolve()

	async init(config: JsonObject, _isFirstInit: boolean): Promise<void> {
		this.#config = readConfig(config)
		this.#define()
		await this.#connect()
	}

	async destroy(): Promise<void> {
		for (const timer of this.#releaseTimers.values()) clearTimeout(timer)
		this.#releaseTimers.clear()
		await this.#closeAtem()
	}

	async configUpdated(config: JsonObject): Promise<void> {
		const next = readConfig(config)
		const hostChanged = next.host !== this.#config.host || next.port !== this.#config.port
		this.#config = next
		this.#define()
		if (hostChanged) await this.#connect()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'What this connection does',
				value:
					'Encoder buttons for upstream keyer numbers: DVE position, size, rotation, mask and border, plus luma, chroma and pattern. It can run next to the normal Blackmagic ATEM module. Presets go on a Stream Deck encoder. Fine and Coarse are step sizes; Custom is your own step.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'ATEM IP address',
				width: 8,
				default: '192.168.10.240',
				regex: Regex.IP,
			},
			{
				type: 'number',
				id: 'port',
				label: 'Port',
				width: 4,
				default: 9910,
				min: 1,
				max: 65535,
				step: 1,
			},
		]
	}

	#define(): void {
		const parameterChoices = PARAMETERS.map((spec) => ({ id: spec.id, label: spec.label }))
		const meField = {
			type: 'number' as const,
			id: 'me' as const,
			label: 'Mix effect',
			min: 1,
			max: MAX_MIX_EFFECTS,
			default: 1,
			step: 1,
			asInteger: true,
		}
		const keyerField = {
			type: 'number' as const,
			id: 'keyer' as const,
			label: 'Upstream keyer',
			min: 1,
			max: MAX_KEYERS,
			default: 1,
			step: 1,
			asInteger: true,
		}
		const parameterField = {
			type: 'dropdown' as const,
			id: 'parameter' as const,
			label: 'Value',
			default: PARAMETERS[0].id,
			choices: parameterChoices,
			minChoicesForSearch: 8,
		}

		this.setActionDefinitions({
			nudge: {
				name: 'Adjust value with encoder',
				description:
					'Adds or subtracts a fine, coarse, or custom step. On a Stream Deck encoder set Direction to Encoder turn, set Ticks to the expression $(this:delta), and put the action on both Rotate left and Rotate right. A fast spin applies every detent. Increase and Decrease are for a button press, one step each time. The presets are already set up this way.',
				options: [
					meField,
					keyerField,
					parameterField,
					{
						type: 'dropdown',
						id: 'speed',
						label: 'Step size',
						default: 'fine',
						disableAutoExpression: true,
						choices: [
							{ id: 'fine', label: 'Fine' },
							{ id: 'coarse', label: 'Coarse' },
							{ id: 'custom', label: 'Custom' },
						],
					},
					{
						type: 'number',
						id: 'customStep',
						label: 'Custom step',
						tooltip: 'Added for each detent, in the same units as the value. Ignored unless Step size is Custom.',
						default: 1,
						min: -1000,
						max: 1000,
						step: 0.01,
						isVisibleExpression: '$(options:speed) == "custom"',
					},
					{
						type: 'dropdown',
						id: 'direction',
						label: 'Direction',
						default: 'encoder',
						disableAutoExpression: true,
						choices: [
							{ id: 'encoder', label: 'Encoder turn ($(this:delta))' },
							{ id: 'increase', label: 'Increase one step' },
							{ id: 'decrease', label: 'Decrease one step' },
						],
					},
					{
						type: 'number',
						id: 'ticks',
						label: 'Encoder ticks',
						tooltip:
							'For an encoder, make this an expression: $(this:delta). The sign is the direction and the size is how many detents this turn moved.',
						default: 1,
						min: -1000000,
						max: 1000000,
						step: 1,
						isVisibleExpression: '$(options:direction) == "encoder"',
					},
				],
				callback: async (action) => {
					await this.#nudge(action.options as unknown as NudgeOptions)
				},
			},
			set: {
				name: 'Set value',
				description: 'Writes an exact number into the same fields the encoder adjusts. Learn reads the current value.',
				options: [
					meField,
					keyerField,
					parameterField,
					{
						type: 'number',
						id: 'value',
						label: 'Value',
						tooltip: 'Clamped to the range of the chosen field. DVE position is -1000 to 1000, size is 0 to 99.99, key percentages are 0 to 100.',
						default: 0,
						min: -1000,
						max: 1000,
						step: 0.01,
					},
				],
				callback: async (action) => {
					await this.#setAbsolute(action.options as unknown as SetOptions)
				},
				learn: (action) => {
					const options = action.options as unknown as SetOptions
					const read = this.#readUser(options.me, options.keyer, String(options.parameter))
					if (read === undefined) return undefined
					return { value: read.user }
				},
			},
		})

		this.setFeedbackDefinitions({
			onAir: {
				type: 'boolean',
				name: 'Upstream keyer on air',
				description: 'True while the selected upstream keyer is on air.',
				defaultStyle: { bgcolor: 0xff6600, color: 0x000000 },
				options: [meField, keyerField],
				callback: (feedback) => {
					const me = Math.round(Number(feedback.options.me))
					const keyer = Math.round(Number(feedback.options.keyer))
					return this.#onAir.get(`${me}:${keyer}`) === true
				},
			},
		})

		const variables: Record<string, { name: string }> = {}
		for (let me = 1; me <= MAX_MIX_EFFECTS; me++) {
			for (let keyer = 1; keyer <= MAX_KEYERS; keyer++) {
				for (const spec of PARAMETERS) {
					variables[variableId(me, keyer, spec)] = { name: `ME${me} USK${keyer} ${spec.label}` }
				}
			}
		}
		this.setVariableDefinitions(variables)

		const { sections, presets } = buildPresetSections(this.label || 'atem')
		this.setPresetDefinitions(sections, presets)
	}

	async #nudge(options: NudgeOptions): Promise<void> {
		const located = this.#locate(options.me, options.keyer, String(options.parameter))
		if (!located) return
		const { me, keyer, spec } = located
		const atem = this.#atem
		if (!atem?.state) {
			this.log('warn', 'Not connected to the ATEM')
			return
		}
		const key = pendingKey(me, keyer, spec)
		const result = applyNudge({
			reportedProtocol: readProtocol(atem.state, me, keyer, spec),
			pendingUser: this.#pending.get(key),
			direction: String(options.direction),
			ticks: Number(options.ticks),
			speed: String(options.speed),
			customStep: Number(options.customStep),
			spec,
		})
		if (!result) return
		await this.#apply(me, keyer, spec, result.user, result.protocol)
	}

	async #setAbsolute(options: SetOptions): Promise<void> {
		const located = this.#locate(options.me, options.keyer, String(options.parameter))
		if (!located) return
		const { me, keyer, spec } = located
		if (!this.#atem?.state) {
			this.log('warn', 'Not connected to the ATEM')
			return
		}
		const requested = Number(options.value)
		if (!Number.isFinite(requested)) return
		const user = spec.wrap ? requested : Math.min(spec.max, Math.max(spec.min, requested))
		const protocol = userToProtocol(spec, user)
		await this.#apply(me, keyer, spec, protocolToUser(spec, protocol), protocol)
	}

	async #apply(me: number, keyer: number, spec: ParameterSpec, user: number, protocol: number): Promise<void> {
		const key = pendingKey(me, keyer, spec)
		this.#pending.set(key, user)
		this.#publishValues({ [variableId(me + 1, keyer + 1, spec)]: user })
		await this.#enqueue(async () => {
			const atem = this.#atem
			if (!atem) return
			try {
				await sendProperty(atem, me, keyer, spec, protocol)
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				this.log('error', `Failed to set ${spec.label}: ${message}`)
				this.#pending.delete(key)
				this.#publishFromState()
				return
			}
			this.#armRelease(key)
		})
	}

	#locate(
		meValue: unknown,
		keyerValue: unknown,
		parameterId: string
	): { me: number; keyer: number; spec: ParameterSpec } | undefined {
		const spec = parameterById(parameterId)
		if (!spec) {
			this.log('warn', `Unknown value "${parameterId}"`)
			return undefined
		}
		const me = Math.round(Number(meValue)) - 1
		const keyer = Math.round(Number(keyerValue)) - 1
		if (me < 0 || me >= MAX_MIX_EFFECTS || keyer < 0 || keyer >= MAX_KEYERS) {
			this.log('warn', `Mix effect ${String(meValue)} keyer ${String(keyerValue)} is out of range`)
			return undefined
		}
		return { me, keyer, spec }
	}

	#readUser(meValue: unknown, keyerValue: unknown, parameterId: string): { user: number } | undefined {
		const located = this.#locate(meValue, keyerValue, parameterId)
		const state = this.#atem?.state
		if (!located || !state) return undefined
		const protocol = readProtocol(state, located.me, located.keyer, located.spec)
		if (protocol === undefined) return undefined
		const pending = this.#pending.get(pendingKey(located.me, located.keyer, located.spec))
		if (pending !== undefined) return { user: pending }
		return { user: protocolToUser(located.spec, protocol) }
	}

	async #enqueue(task: () => Promise<void>): Promise<void> {
		const run = this.#sendChain.then(task, task)
		this.#sendChain = run.then(
			() => undefined,
			() => undefined
		)
		await run
	}

	#armRelease(key: string): void {
		const existing = this.#releaseTimers.get(key)
		if (existing) clearTimeout(existing)
		const timer = setTimeout(() => {
			this.#releaseTimers.delete(key)
			this.#pending.delete(key)
			this.#publishFromState()
		}, 800)
		this.#releaseTimers.set(key, timer)
	}

	async #connect(): Promise<void> {
		await this.#closeAtem()
		const host = (this.#config.host ?? '').trim()
		const port = Number(this.#config.port) || 9910
		if (!host) {
			this.updateStatus(InstanceStatus.BadConfig, 'Set the ATEM IP address')
			return
		}

		const atem = new Atem({ disableMultithreaded: true })
		this.#atem = atem
		atem.on('connected', () => {
			if (this.#atem !== atem) return
			this.updateStatus(InstanceStatus.Ok)
			this.log('info', `Connected to ${host}:${port}`)
			this.#publishFromState()
		})
		atem.on('disconnected', () => {
			if (this.#atem !== atem) return
			this.updateStatus(InstanceStatus.Disconnected, 'Disconnected')
		})
		atem.on('error', (message) => {
			if (this.#atem !== atem) return
			this.log('error', String(message))
		})
		atem.on('stateChanged', () => {
			if (this.#atem !== atem) return
			this.#publishFromState()
		})

		this.updateStatus(InstanceStatus.Connecting)
		try {
			await atem.connect(host, port)
		} catch (error) {
			if (this.#atem !== atem) return
			const message = error instanceof Error ? error.message : String(error)
			this.updateStatus(InstanceStatus.ConnectionFailure, message)
			this.log('error', `Connect failed: ${message}`)
		}
	}

	async #closeAtem(): Promise<void> {
		const atem = this.#atem
		this.#atem = undefined
		if (!atem) return
		await atem.disconnect().catch(() => undefined)
	}

	#publishFromState(): void {
		const state = this.#atem?.state
		if (!state) return
		const values: DialVariables = {}
		let onAirChanged = false
		for (let me = 0; me < MAX_MIX_EFFECTS; me++) {
			for (let keyer = 0; keyer < MAX_KEYERS; keyer++) {
				const usk = state.video.mixEffects[me]?.upstreamKeyers[keyer]
				const onAirKey = `${me + 1}:${keyer + 1}`
				const onAir = usk?.onAir === true
				if (this.#onAir.get(onAirKey) !== onAir) {
					this.#onAir.set(onAirKey, onAir)
					onAirChanged = true
				}
				for (const spec of PARAMETERS) {
					const key = pendingKey(me, keyer, spec)
					const pending = this.#pending.get(key)
					const protocol = readProtocol(state, me, keyer, spec)
					let user = protocol === undefined ? undefined : protocolToUser(spec, protocol)
					if (pending !== undefined) {
						if (protocol !== undefined && userToProtocol(spec, pending) === protocol) {
							this.#pending.delete(key)
							const timer = this.#releaseTimers.get(key)
							if (timer) clearTimeout(timer)
							this.#releaseTimers.delete(key)
						} else {
							user = pending
						}
					}
					if (user === undefined) continue
					values[variableId(me + 1, keyer + 1, spec)] = user
				}
			}
		}
		if (Object.keys(values).length > 0) this.#publishValues(values)
		if (onAirChanged) this.checkFeedbacks('onAir')
	}

	#publishValues(values: DialVariables): void {
		const changed: DialVariables = {}
		for (const [id, value] of Object.entries(values)) {
			if (typeof value !== 'number' || !Number.isFinite(value)) continue
			if (this.#published.get(id) === value) continue
			this.#published.set(id, value)
			changed[id] = value
		}
		if (Object.keys(changed).length > 0) this.setVariableValues(changed)
	}
}

function readConfig(config: JsonObject): ModuleConfig {
	return {
		host: typeof config.host === 'string' ? config.host : '',
		port: typeof config.port === 'number' ? config.port : 9910,
	}
}

function pendingKey(me: number, keyer: number, spec: ParameterSpec): string {
	return `${me}:${keyer}:${spec.id}`
}

function readProtocol(state: AtemState, me: number, keyer: number, spec: ParameterSpec): number | undefined {
	const usk = state.video.mixEffects[me]?.upstreamKeyers[keyer]
	if (!usk) return undefined
	const source =
		spec.group === 'dve'
			? usk.dveSettings
			: spec.group === 'luma'
				? usk.lumaSettings
				: spec.group === 'chroma'
					? usk.chromaSettings
					: spec.group === 'pattern'
						? usk.patternSettings
						: usk.advancedChromaSettings?.properties
	if (!source) return undefined
	const value = (source as unknown as Record<string, unknown>)[spec.property]
	return typeof value === 'number' ? value : undefined
}

async function sendProperty(
	atem: Atem,
	me: number,
	keyer: number,
	spec: ParameterSpec,
	protocol: number
): Promise<void> {
	const props = { [spec.property]: protocol }
	switch (spec.group) {
		case 'dve':
			await atem.setUpstreamKeyerDVESettings(props as Partial<VideoState.USK.UpstreamKeyerDVESettings>, me, keyer)
			return
		case 'luma':
			await atem.setUpstreamKeyerLumaSettings(props as Partial<VideoState.USK.UpstreamKeyerLumaSettings>, me, keyer)
			return
		case 'chroma':
			await atem.setUpstreamKeyerChromaSettings(props as Partial<VideoState.USK.UpstreamKeyerChromaSettings>, me, keyer)
			return
		case 'advancedChroma':
			await atem.setUpstreamKeyerAdvancedChromaProperties(
				props as Partial<VideoState.USK.UpstreamKeyerAdvancedChromaProperties>,
				me,
				keyer
			)
			return
		case 'pattern':
			await atem.setUpstreamKeyerPatternSettings(
				props as Partial<VideoState.USK.UpstreamKeyerPatternSettings>,
				me,
				keyer
			)
			return
	}
}

export default AtemDialsInstance
