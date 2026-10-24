import { describe, expect, it } from 'vitest'
import { allocateInstanceLabels } from '../Label.js'

describe('allocateInstanceLabels', () => {
	it('counts up from a numbered label', () => {
		expect(allocateInstanceLabels('PTZ-1', 6, new Set())).toEqual([
			'PTZ-1',
			'PTZ-2',
			'PTZ-3',
			'PTZ-4',
			'PTZ-5',
			'PTZ-6',
		])
	})

	it('skips labels that are already used', () => {
		expect(allocateInstanceLabels('PTZ-1', 3, new Set(['PTZ-2']))).toEqual(['PTZ-1', 'PTZ-3', 'PTZ-4'])
	})

	it('uses the usual suffix when the label has no trailing number', () => {
		expect(allocateInstanceLabels('PTZ', 3, new Set(['PTZ']))).toEqual(['PTZ_2', 'PTZ_3', 'PTZ_4'])
		expect(allocateInstanceLabels('PTZ', 1, new Set())).toEqual(['PTZ'])
	})

	it('makes an unsafe label safe before numbering', () => {
		expect(allocateInstanceLabels('PTZ 1', 2, new Set())).toEqual(['PTZ_1', 'PTZ_2'])
	})

	it('rejects an empty label or a bad count', () => {
		expect(allocateInstanceLabels('   ', 3, new Set())).toEqual([])
		expect(allocateInstanceLabels('PTZ-1', 0, new Set())).toEqual([])
	})

	it('stops at 50 connections', () => {
		expect(allocateInstanceLabels('PTZ-1', 50, new Set())).toHaveLength(50)
		expect(allocateInstanceLabels('PTZ-1', 51, new Set())).toHaveLength(50)
		expect(allocateInstanceLabels('PTZ-1', 51, new Set()).at(-1)).toBe('PTZ-50')
	})
})
