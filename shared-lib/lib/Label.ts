/**
 * Make a label 'safe' according to the valid regex
 * @param label Label to check
 * @returns 'safe' version of the label
 */
export function makeLabelSafe(label: string): string {
	return label.trim().replace(/[^\w-]/gi, '_')
}

/**
 * Check if a label is valid
 * @param label Label to check
 */
export function isLabelValid(label: string): boolean {
	if (!label || typeof label !== 'string') return false

	// Check a few reserved words
	if (
		label.toLowerCase() === 'internal' ||
		label.toLowerCase() === 'this' ||
		label.toLowerCase() === 'local' ||
		label.toLowerCase() === 'companion' ||
		label.toLowerCase() === 'image' ||
		label.toLowerCase() === 'custom' ||
		label.toLowerCase() === 'expression' ||
		label.toLowerCase() === 'page'
	)
		return false

	const safeLabel = makeLabelSafe(label)
	return safeLabel === label
}

export function isEmulatorIdValid(id: string): boolean {
	if (!id || typeof id !== 'string') return false

	const safeId = makeLabelSafe(id)
	return safeId === id
}

export function isSurfaceGroupIdValid(id: string): boolean {
	if (!id || typeof id !== 'string') return false

	const safeId = makeLabelSafe(id)
	return safeId === id
}

const MAX_INSTANCE_BATCH = 50

/**
 * Labels for several new instances.
 * A label that ends with a number counts up: `PTZ-1` six times is `PTZ-1` … `PTZ-6`.
 * Anything else follows the usual scheme: `PTZ`, then `PTZ_2`, `PTZ_3`.
 * Labels already in `taken` are skipped.
 */
export function allocateInstanceLabels(startLabel: string, count: number, taken: ReadonlySet<string>): string[] {
	const safe = makeLabelSafe(startLabel)
	if (!safe || !Number.isInteger(count) || count < 1) return []

	const total = Math.min(count, MAX_INSTANCE_BATCH)
	const used = new Set(taken)
	const labels: string[] = []
	let candidate = safe

	for (let i = 0; i < total; i++) {
		while (used.has(candidate)) candidate = stepInstanceLabel(candidate)
		labels.push(candidate)
		used.add(candidate)
		candidate = stepInstanceLabel(candidate)
	}

	return labels
}

function stepInstanceLabel(label: string): string {
	const match = /^(.*?)(\d+)$/.exec(label)
	if (!match) return `${label}_2`
	return `${match[1]}${Number(match[2]) + 1}`
}
