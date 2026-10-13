import { describe, expect, test } from 'vitest'
import {
	InstanceVersionUpdatePolicy,
	ModuleInstanceType,
	type InstanceConfig,
} from '@companion-app/shared/Model/Instance.js'
import {
	ATEM_DIALS_MODULE_ID,
	ATEM_SWITCHER_MODULE_ID,
	enrichAtemDialsConfig,
} from '../../../lib/Instance/Connection/AtemDialsLink.js'

function connection(moduleId: string, config: unknown, enabled = true): InstanceConfig {
	return {
		moduleInstanceType: ModuleInstanceType.Connection,
		moduleId,
		moduleVersionId: null,
		label: moduleId,
		config,
		secrets: undefined,
		isFirstInit: false,
		lastUpgradeIndex: 0,
		enabled,
		sortOrder: 0,
		updatePolicy: InstanceVersionUpdatePolicy.Stable,
	}
}

describe('enrichAtemDialsConfig', () => {
	test('leaves other modules alone', () => {
		const original = connection('bmd-atem', { host: '10.0.0.2' })
		expect(enrichAtemDialsConfig(original, () => undefined)).toBe(original)
	})

	test('copies the selected switcher address and does not change the stored object', () => {
		const stored = { atemConnection: 'atem1' }
		const dials = connection(ATEM_DIALS_MODULE_ID, stored)
		const enriched = enrichAtemDialsConfig(dials, (id) =>
			id === 'atem1' ? connection(ATEM_SWITCHER_MODULE_ID, { host: '192.168.10.240' }) : undefined
		)

		expect(enriched.config).toEqual({ atemConnection: 'atem1', host: '192.168.10.240', port: 9910 })
		expect(stored).toEqual({ atemConnection: 'atem1' })
	})

	test('prefers the bonjour address, including its port', () => {
		const dials = connection(ATEM_DIALS_MODULE_ID, { atemConnection: 'atem1' })
		const enriched = enrichAtemDialsConfig(dials, () =>
			connection(ATEM_SWITCHER_MODULE_ID, { bonjourHost: '10.1.1.8:9910', host: '192.168.0.1' })
		)

		expect(enriched.config).toMatchObject({ host: '10.1.1.8', port: 9910 })
	})

	test('does not connect when the switcher is missing or disabled', () => {
		const dials = connection(ATEM_DIALS_MODULE_ID, { atemConnection: 'atem1' })
		const disabled = enrichAtemDialsConfig(dials, () =>
			connection(ATEM_SWITCHER_MODULE_ID, { host: '10.0.0.2' }, false)
		)
		const missing = enrichAtemDialsConfig(dials, () => undefined)

		expect(disabled.config).toMatchObject({ host: '' })
		expect(missing.config).toMatchObject({ host: '' })
	})
})
