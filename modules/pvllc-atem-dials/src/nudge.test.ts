import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyNudge, protocolToUser, userToProtocol } from './nudge.js'
import { PARAMETERS, parameterById } from './parameters.js'

function spec(id: string) {
	const found = parameterById(id)
	assert.ok(found, id)
	return found
}

describe('protocol scale', () => {
	it('matches the ATEM fixed-point units', () => {
		assert.equal(userToProtocol(spec('dve_position_x'), 12), 12000)
		assert.equal(userToProtocol(spec('dve_position_x'), 1000), 1000000)
		assert.equal(userToProtocol(spec('dve_position_x'), -1000), -1000000)
		assert.equal(userToProtocol(spec('dve_size_x'), 99.99), 99990)
		assert.equal(userToProtocol(spec('dve_size_x'), 0.01), 10)
		assert.equal(userToProtocol(spec('dve_rotation'), 180), 1800)
		assert.equal(userToProtocol(spec('dve_mask_top'), 38), 38000)
		assert.equal(userToProtocol(spec('dve_border_outer'), 16), 1600)
		assert.equal(userToProtocol(spec('luma_clip'), 12.5), 125)
		assert.equal(userToProtocol(spec('chroma_hue'), 359.9), 3599)
		assert.equal(protocolToUser(spec('luma_gain'), 1000), 100)
		assert.equal(userToProtocol(spec('dsk_clip'), 12.5), 125)
		assert.equal(userToProtocol(spec('dsk_mask_left'), -16), -16000)
		assert.equal(userToProtocol(spec('dsk_rate'), 25), 25)
	})

	it('gives every fine step at least one protocol unit', () => {
		for (const parameter of PARAMETERS) {
			const protocolStep = Math.round(parameter.fine * parameter.scale)
			assert.ok(protocolStep >= 1, parameter.id)
		}
	})
})

describe('applyNudge', () => {
	it('adds a fine step to the reported value', () => {
		const result = applyNudge({
			reportedProtocol: 0,
			pendingUser: undefined,
			direction: 'encoder',
			ticks: 1,
			speed: 'fine',
			customStep: 1,
			spec: spec('dve_position_x'),
		})
		assert.deepEqual(result, { user: 1, protocol: 1000 })
	})

	it('multiplies a coarse step by the whole turn', () => {
		const result = applyNudge({
			reportedProtocol: 0,
			pendingUser: undefined,
			direction: 'encoder',
			ticks: -3,
			speed: 'coarse',
			customStep: 1,
			spec: spec('dve_position_x'),
		})
		assert.deepEqual(result, { user: -30, protocol: -30000 })
	})

	it('keeps going from the pending value instead of the stale report', () => {
		const result = applyNudge({
			reportedProtocol: 0,
			pendingUser: 10,
			direction: 'encoder',
			ticks: 1,
			speed: 'fine',
			customStep: 1,
			spec: spec('dve_position_x'),
		})
		assert.deepEqual(result, { user: 11, protocol: 11000 })
	})

	it('stops at the end of the range', () => {
		const result = applyNudge({
			reportedProtocol: 1000000,
			pendingUser: undefined,
			direction: 'increase',
			ticks: 1,
			speed: 'coarse',
			customStep: 1,
			spec: spec('dve_position_x'),
		})
		assert.equal(result, undefined)
	})

	it('clamps a step that would pass the end', () => {
		const result = applyNudge({
			reportedProtocol: 995000,
			pendingUser: undefined,
			direction: 'encoder',
			ticks: 1,
			speed: 'coarse',
			customStep: 1,
			spec: spec('dve_position_x'),
		})
		assert.deepEqual(result, { user: 1000, protocol: 1000000 })
	})

	it('wraps rotation', () => {
		const result = applyNudge({
			reportedProtocol: 3590,
			pendingUser: undefined,
			direction: 'encoder',
			ticks: 2,
			speed: 'coarse',
			customStep: 1,
			spec: spec('dve_rotation'),
		})
		assert.deepEqual(result, { user: 9, protocol: 90 })
	})

	it('moves luma clip by a tenth in fine mode', () => {
		const result = applyNudge({
			reportedProtocol: 500,
			pendingUser: undefined,
			direction: 'decrease',
			ticks: 99,
			speed: 'fine',
			customStep: 50,
			spec: spec('luma_clip'),
		})
		assert.deepEqual(result, { user: 49.9, protocol: 499 })
	})

	it('uses the custom step', () => {
		const result = applyNudge({
			reportedProtocol: 100,
			pendingUser: undefined,
			direction: 'encoder',
			ticks: 4,
			speed: 'custom',
			customStep: 0.25,
			spec: spec('luma_gain'),
		})
		assert.deepEqual(result, { user: 11, protocol: 110 })
	})

	it('does nothing without a known value or a zero turn', () => {
		const base = {
			pendingUser: undefined,
			direction: 'encoder',
			speed: 'fine',
			customStep: 1,
			spec: spec('chroma_hue'),
		}
		assert.equal(applyNudge({ ...base, reportedProtocol: undefined, ticks: 1 }), undefined)
		assert.equal(applyNudge({ ...base, reportedProtocol: 0, ticks: 0 }), undefined)
	})

	it('wraps chroma hue across the full circle', () => {
		const up = applyNudge({
			reportedProtocol: 3599,
			pendingUser: undefined,
			direction: 'encoder',
			ticks: 1,
			speed: 'fine',
			customStep: 1,
			spec: spec('chroma_hue'),
		})
		assert.deepEqual(up, { user: 0, protocol: 0 })

		const down = applyNudge({
			reportedProtocol: 0,
			pendingUser: undefined,
			direction: 'decrease',
			ticks: 1,
			speed: 'fine',
			customStep: 1,
			spec: spec('chroma_hue'),
		})
		assert.deepEqual(down, { user: 359.9, protocol: 3599 })
	})

	it('scales pattern position to the 0–1 range', () => {
		assert.equal(userToProtocol(spec('pattern_position_x'), 0.5), 5000)
		assert.equal(userToProtocol(spec('pattern_size'), 50), 5000)
		const result = applyNudge({
			reportedProtocol: 5000,
			pendingUser: undefined,
			direction: 'encoder',
			ticks: 2,
			speed: 'coarse',
			customStep: 1,
			spec: spec('pattern_position_y'),
		})
		assert.deepEqual(result, { user: 0.7, protocol: 7000 })
	})

	it('still moves when the custom step is smaller than one protocol unit', () => {
		const result = applyNudge({
			reportedProtocol: 0,
			pendingUser: undefined,
			direction: 'encoder',
			ticks: 1,
			speed: 'custom',
			customStep: 0.0001,
			spec: spec('dve_position_x'),
		})
		assert.deepEqual(result, { user: 0.001, protocol: 1 })
	})
})
