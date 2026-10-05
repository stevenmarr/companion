import type { ExportInstancesv6 } from '@companion-app/shared/Model/ExportModel.js'
import type { InstanceVersionUpdatePolicy } from '@companion-app/shared/Model/Instance.js'
import type { PageClassSlot } from '@companion-app/shared/Model/PageClassModel.js'

/** One connection captured with a page class, including the settings needed to clone it. */
export interface CapturedConnection extends PageClassSlot {
	moduleVersionId: string | null
	updatePolicy: InstanceVersionUpdatePolicy | undefined
	lastUpgradeIndex: number
	enabled: boolean
	config: unknown
	secrets: unknown
}

export function readCapturedConnections(instances: ExportInstancesv6 | undefined): CapturedConnection[] {
	if (!instances) return []

	const captured: CapturedConnection[] = []
	for (const [connectionId, raw] of Object.entries(instances)) {
		if (!raw || !raw.label || !raw.moduleId) continue

		captured.push({
			connectionId,
			label: raw.label,
			moduleId: raw.moduleId,
			moduleVersionId: raw.moduleVersionId ?? null,
			updatePolicy: raw.updatePolicy,
			lastUpgradeIndex: raw.lastUpgradeIndex,
			enabled: !('enabled' in raw) || raw.enabled !== false,
			config: 'config' in raw ? raw.config : null,
			secrets: 'secrets' in raw ? raw.secrets : null,
		})
	}

	captured.sort((a, b) => a.label.localeCompare(b.label))
	return captured
}

export function slotsFromCaptured(connections: CapturedConnection[]): PageClassSlot[] {
	return connections.map(({ connectionId, label, moduleId }) => ({ connectionId, label, moduleId }))
}
