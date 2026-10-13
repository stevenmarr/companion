import type { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import { PARAMETER_GROUPS, PARAMETERS, type ParameterSpec } from './parameters.js'

export type SpeedName = 'fine' | 'coarse'

const encoderTicks = { value: '$(this:delta)', isExpression: true as const }
const localMe = { value: '$(local:me)', isExpression: true as const }
const localKeyer = { value: '$(local:keyer)', isExpression: true as const }

function nudgeOptions(spec: ParameterSpec, speed: SpeedName) {
	const options = {
		keyer: localKeyer,
		parameter: spec.id,
		speed,
		customStep: spec.fine,
		direction: 'encoder',
		ticks: encoderTicks,
	}
	if (spec.scope === 'dsk') return options
	return { me: localMe, ...options }
}

function presetFor(label: string, spec: ParameterSpec, speed: SpeedName) {
	const isDownstream = spec.scope === 'dsk'
	const speedLabel = speed === 'fine' ? 'fine' : 'coarse'
	const step = speed === 'fine' ? spec.fine : spec.coarse
	const action = {
		actionId: isDownstream ? ('nudgeDownstream' as const) : ('nudge' as const),
		headline: `${spec.label} ${speedLabel} (${step})`,
		options: nudgeOptions(spec, speed),
	}
	const valueVariable = isDownstream
		? `$(${label}:dsk$(local:keyer)_${spec.id})`
		: `$(${label}:me$(local:me)_usk$(local:keyer)_${spec.id})`
	return {
		type: 'simple' as const,
		name: `${spec.label} (${speedLabel})`,
		keywords: [spec.group, speedLabel, 'encoder', 'dial', isDownstream ? 'dsk' : 'usk'],
		notes: isDownstream
			? `Drag onto a Stream Deck encoder. Companion asks which downstream keyer this knob controls. Each detent moves ${spec.label} by ${step} (${speedLabel}).`
			: `Drag onto a Stream Deck encoder. Companion asks which mix effect and upstream keyer this knob controls. Each detent moves ${spec.label} by ${step} (${speedLabel}).`,
		style: {
			text: `${spec.shortLabel}\n${valueVariable}`,
			size: '14' as const,
			color: 0xffb000,
			bgcolor: 0x000000,
			alignment: 'center:center' as const,
		},
		steps: [
			{
				down: [],
				up: [],
				rotate_left: [{ ...action, options: { ...action.options } }],
				rotate_right: [{ ...action, options: { ...action.options } }],
			},
		],
		feedbacks: [
			isDownstream
				? {
						feedbackId: 'dskOnAir' as const,
						options: { keyer: localKeyer },
						style: { bgcolor: 0xff6600, color: 0x000000 },
					}
				: {
						feedbackId: 'onAir' as const,
						options: { me: localMe, keyer: localKeyer },
						style: { bgcolor: 0xff6600, color: 0x000000 },
					},
		],
		localVariables: isDownstream
			? [{ variableType: 'simple' as const, variableName: 'keyer', startupValue: 1, headline: 'Downstream keyer' }]
			: [
					{ variableType: 'simple' as const, variableName: 'me', startupValue: 1, headline: 'Mix effect' },
					{ variableType: 'simple' as const, variableName: 'keyer', startupValue: 1, headline: 'Upstream keyer' },
				],
	}
}

export function buildPresetSections(label: string): {
	sections: CompanionPresetSection[]
	presets: CompanionPresetDefinitions
} {
	const presets: CompanionPresetDefinitions = {}
	const sections: CompanionPresetSection[] = []

	for (const group of PARAMETER_GROUPS) {
		const fineIds: string[] = []
		const coarseIds: string[] = []
		for (const spec of PARAMETERS) {
			if (spec.group !== group.id) continue
			const fineId = `${spec.id}_fine`
			const coarseId = `${spec.id}_coarse`
			presets[fineId] = presetFor(label, spec, 'fine')
			presets[coarseId] = presetFor(label, spec, 'coarse')
			fineIds.push(fineId)
			coarseIds.push(coarseId)
		}
		sections.push({
			id: group.id,
			name: group.name,
			description:
				'Encoder buttons. Dropping one asks which mix effect and keyer it controls. Fine is a small step, coarse is a larger one.',
			definitions: [
				{ id: `${group.id}-fine`, type: 'simple', name: 'Fine', presets: fineIds },
				{ id: `${group.id}-coarse`, type: 'simple', name: 'Coarse', presets: coarseIds },
			],
		})
	}

	return { sections, presets }
}
