/**
 * User-facing units match the Blackmagic ATEM Companion module (bmd-atem):
 * position and mask are multiplied by 1000 on the wire, rotation and most
 * key percentages by 10, DVE border width by 100, pattern size by 100 and
 * pattern position by 10000. Fine is one small click of that control.
 * Coarse is a handful of those clicks.
 */

export type ParameterGroup = 'dve' | 'luma' | 'chroma' | 'advancedChroma' | 'pattern'

export interface ParameterSpec {
	readonly id: string
	readonly group: ParameterGroup
	readonly property: string
	readonly label: string
	readonly shortLabel: string
	readonly min: number
	readonly max: number
	readonly scale: number
	readonly fine: number
	readonly coarse: number
	readonly decimals: number
	/** Turning past the end comes back in the other side. Used for angles. */
	readonly wrap?: boolean
	/**
	 * Length of one full turn, in user units. Hue stores 0–359.9 but a circle is 360,
	 * so the next tenth after 359.9 is 0. Defaults to max - min.
	 */
	readonly wrapModulo?: number
}

export const MAX_MIX_EFFECTS = 4
export const MAX_KEYERS = 4

export const PARAMETER_GROUPS: ReadonlyArray<{ id: ParameterGroup; name: string }> = [
	{ id: 'dve', name: 'DVE' },
	{ id: 'luma', name: 'Luma key' },
	{ id: 'chroma', name: 'Chroma key' },
	{ id: 'advancedChroma', name: 'Advanced chroma key' },
	{ id: 'pattern', name: 'Pattern key' },
]

const percent = (
	id: string,
	group: ParameterGroup,
	property: string,
	label: string,
	shortLabel: string
): ParameterSpec => ({
	id,
	group,
	property,
	label,
	shortLabel,
	min: 0,
	max: 100,
	scale: 10,
	fine: 0.1,
	coarse: 1,
	decimals: 1,
})

export const PARAMETERS: readonly ParameterSpec[] = [
	{
		id: 'dve_position_x',
		group: 'dve',
		property: 'positionX',
		label: 'DVE position X',
		shortLabel: 'DVE X',
		min: -1000,
		max: 1000,
		scale: 1000,
		fine: 1,
		coarse: 10,
		decimals: 0,
	},
	{
		id: 'dve_position_y',
		group: 'dve',
		property: 'positionY',
		label: 'DVE position Y',
		shortLabel: 'DVE Y',
		min: -1000,
		max: 1000,
		scale: 1000,
		fine: 1,
		coarse: 10,
		decimals: 0,
	},
	{
		id: 'dve_size_x',
		group: 'dve',
		property: 'sizeX',
		label: 'DVE size X',
		shortLabel: 'Size X',
		min: 0,
		max: 99.99,
		scale: 1000,
		fine: 0.01,
		coarse: 1,
		decimals: 2,
	},
	{
		id: 'dve_size_y',
		group: 'dve',
		property: 'sizeY',
		label: 'DVE size Y',
		shortLabel: 'Size Y',
		min: 0,
		max: 99.99,
		scale: 1000,
		fine: 0.01,
		coarse: 1,
		decimals: 2,
	},
	{
		id: 'dve_rotation',
		group: 'dve',
		property: 'rotation',
		label: 'DVE rotation',
		shortLabel: 'Rotate',
		min: 0,
		max: 360,
		scale: 10,
		fine: 0.1,
		coarse: 5,
		decimals: 1,
		wrap: true,
	},
	{
		id: 'dve_mask_top',
		group: 'dve',
		property: 'maskTop',
		label: 'DVE mask top',
		shortLabel: 'Mask top',
		min: 0,
		max: 38,
		scale: 1000,
		fine: 0.1,
		coarse: 1,
		decimals: 1,
	},
	{
		id: 'dve_mask_bottom',
		group: 'dve',
		property: 'maskBottom',
		label: 'DVE mask bottom',
		shortLabel: 'Mask bot',
		min: 0,
		max: 38,
		scale: 1000,
		fine: 0.1,
		coarse: 1,
		decimals: 1,
	},
	{
		id: 'dve_mask_left',
		group: 'dve',
		property: 'maskLeft',
		label: 'DVE mask left',
		shortLabel: 'Mask left',
		min: 0,
		max: 52,
		scale: 1000,
		fine: 0.1,
		coarse: 1,
		decimals: 1,
	},
	{
		id: 'dve_mask_right',
		group: 'dve',
		property: 'maskRight',
		label: 'DVE mask right',
		shortLabel: 'Mask right',
		min: 0,
		max: 52,
		scale: 1000,
		fine: 0.1,
		coarse: 1,
		decimals: 1,
	},
	{
		id: 'dve_border_outer',
		group: 'dve',
		property: 'borderOuterWidth',
		label: 'DVE border outer width',
		shortLabel: 'Border out',
		min: 0,
		max: 16,
		scale: 100,
		fine: 0.1,
		coarse: 1,
		decimals: 1,
	},
	{
		id: 'dve_border_inner',
		group: 'dve',
		property: 'borderInnerWidth',
		label: 'DVE border inner width',
		shortLabel: 'Border in',
		min: 0,
		max: 16,
		scale: 100,
		fine: 0.1,
		coarse: 1,
		decimals: 1,
	},
	{
		id: 'dve_border_outer_soft',
		group: 'dve',
		property: 'borderOuterSoftness',
		label: 'DVE border outer softness',
		shortLabel: 'Soft out',
		min: 0,
		max: 100,
		scale: 1,
		fine: 1,
		coarse: 5,
		decimals: 0,
	},
	{
		id: 'dve_border_inner_soft',
		group: 'dve',
		property: 'borderInnerSoftness',
		label: 'DVE border inner softness',
		shortLabel: 'Soft in',
		min: 0,
		max: 100,
		scale: 1,
		fine: 1,
		coarse: 5,
		decimals: 0,
	},
	{
		id: 'dve_border_opacity',
		group: 'dve',
		property: 'borderOpacity',
		label: 'DVE border opacity',
		shortLabel: 'Border %',
		min: 0,
		max: 100,
		scale: 1,
		fine: 1,
		coarse: 5,
		decimals: 0,
	},
	percent('luma_clip', 'luma', 'clip', 'Luma clip', 'Luma clip'),
	percent('luma_gain', 'luma', 'gain', 'Luma gain', 'Luma gain'),
	{
		id: 'chroma_hue',
		group: 'chroma',
		property: 'hue',
		label: 'Chroma hue',
		shortLabel: 'Hue',
		min: 0,
		max: 359.9,
		scale: 10,
		fine: 0.1,
		coarse: 5,
		decimals: 1,
		wrap: true,
		wrapModulo: 360,
	},
	percent('chroma_gain', 'chroma', 'gain', 'Chroma gain', 'C gain'),
	percent('chroma_y_suppress', 'chroma', 'ySuppress', 'Chroma Y suppress', 'Y sup'),
	percent('chroma_lift', 'chroma', 'lift', 'Chroma lift', 'Lift'),
	percent('adv_foreground', 'advancedChroma', 'foregroundLevel', 'Advanced chroma foreground', 'FG level'),
	percent('adv_background', 'advancedChroma', 'backgroundLevel', 'Advanced chroma background', 'BG level'),
	percent('adv_key_edge', 'advancedChroma', 'keyEdge', 'Advanced chroma key edge', 'Key edge'),
	percent('adv_spill', 'advancedChroma', 'spillSuppression', 'Advanced chroma spill', 'Spill'),
	percent('adv_flare', 'advancedChroma', 'flareSuppression', 'Advanced chroma flare', 'Flare'),
	percent('adv_brightness', 'advancedChroma', 'brightness', 'Advanced chroma brightness', 'Bright'),
	percent('adv_contrast', 'advancedChroma', 'contrast', 'Advanced chroma contrast', 'Contrast'),
	percent('adv_saturation', 'advancedChroma', 'saturation', 'Advanced chroma saturation', 'Sat'),
	percent('adv_red', 'advancedChroma', 'red', 'Advanced chroma red', 'Red'),
	percent('adv_green', 'advancedChroma', 'green', 'Advanced chroma green', 'Green'),
	percent('adv_blue', 'advancedChroma', 'blue', 'Advanced chroma blue', 'Blue'),
	{
		id: 'pattern_size',
		group: 'pattern',
		property: 'size',
		label: 'Pattern size',
		shortLabel: 'Pat size',
		min: 0,
		max: 100,
		scale: 100,
		fine: 0.1,
		coarse: 1,
		decimals: 1,
	},
	{
		id: 'pattern_symmetry',
		group: 'pattern',
		property: 'symmetry',
		label: 'Pattern symmetry',
		shortLabel: 'Pat sym',
		min: 0,
		max: 100,
		scale: 100,
		fine: 0.1,
		coarse: 1,
		decimals: 1,
	},
	{
		id: 'pattern_softness',
		group: 'pattern',
		property: 'softness',
		label: 'Pattern softness',
		shortLabel: 'Pat soft',
		min: 0,
		max: 100,
		scale: 100,
		fine: 0.1,
		coarse: 1,
		decimals: 1,
	},
	{
		id: 'pattern_position_x',
		group: 'pattern',
		property: 'positionX',
		label: 'Pattern position X',
		shortLabel: 'Pat X',
		min: 0,
		max: 1,
		scale: 10000,
		fine: 0.01,
		coarse: 0.1,
		decimals: 2,
	},
	{
		id: 'pattern_position_y',
		group: 'pattern',
		property: 'positionY',
		label: 'Pattern position Y',
		shortLabel: 'Pat Y',
		min: 0,
		max: 1,
		scale: 10000,
		fine: 0.01,
		coarse: 0.1,
		decimals: 2,
	},
]

const BY_ID = new Map(PARAMETERS.map((spec) => [spec.id, spec]))

export function parameterById(id: string): ParameterSpec | undefined {
	return BY_ID.get(id)
}

/** Variable id for the live user value. Mix effect and keyer are 1-based, matching the action fields. */
export function variableId(mixEffect: number, keyer: number, spec: ParameterSpec): string {
	return `me${mixEffect}_usk${keyer}_${spec.id}`
}
