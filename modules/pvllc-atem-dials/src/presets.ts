import type { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import { PARAMETER_GROUPS, PARAMETERS, type ParameterSpec, variableId } from './parameters.js'

export type SpeedName = 'fine' | 'coarse'

const encoderTicks = { value: '$(this:delta)', isExpression: true as const }

function nudgeOptions(spec: ParameterSpec, speed: SpeedName) {
	return {
		me: 1,
		keyer: 1,
		parameter: spec.id,
		speed,
		customStep: spec.fine,
		direction: 'encoder',
		ticks: encoderTicks,
	}
}

function presetFor(label: string, spec: ParameterSpec, speed: SpeedName) {
	const speedLabel = speed === 'fine' ? 'fine' : 'coarse'
	const step = speed === 'fine' ? spec.fine : spec.coarse
	const action = {
		actionId: 'nudge' as const,
		headline: `${spec.label} ${speedLabel} (${step})`,
		options: nudgeOptions(spec, speed),
	}
	return {
		type: 'simple' as const,
		name: `${spec.label} (${speedLabel})`,
		keywords: [spec.group, speedLabel, 'encoder', 'dial'],
		notes: `Drag onto a Stream Deck encoder. Each detent moves ${spec.label} by ${step} (${speedLabel}) on ME 1 key 1. Edit the action to pick another mix effect, keyer, or a custom step. The button text follows ME 1 key 1; change the variable in the text if you move the action to another keyer.`,
		style: {
			text: `${spec.shortLabel}\n$(${label}:${variableId(1, 1, spec)})`,
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
			{
				feedbackId: 'onAir' as const,
				options: { me: 1, keyer: 1 },
				style: { bgcolor: 0xff6600, color: 0x000000 },
			},
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
			description: 'Encoder buttons. Fine is a small step, coarse is a larger one. Both can be changed later on the action.',
			definitions: [
				{ id: `${group.id}-fine`, type: 'simple', name: 'Fine', presets: fineIds },
				{ id: `${group.id}-coarse`, type: 'simple', name: 'Coarse', presets: coarseIds },
			],
		})
	}

	return { sections, presets }
}
