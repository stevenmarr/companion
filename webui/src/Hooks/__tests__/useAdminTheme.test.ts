import { describe, expect, it } from 'vitest'
import { isAdminTheme, resolveAdminTheme } from '../useAdminTheme.js'

describe('admin appearance', () => {
	it('stays light unless dark is chosen or the computer is dark', () => {
		expect(resolveAdminTheme('light', true)).toBe('light')
		expect(resolveAdminTheme(undefined, true)).toBe('light')
		expect(resolveAdminTheme('dark', false)).toBe('dark')
		expect(resolveAdminTheme('system', true)).toBe('dark')
		expect(resolveAdminTheme('system', false)).toBe('light')
	})

	it('only treats the three saved values as a theme', () => {
		expect(isAdminTheme('dark')).toBe(true)
		expect(isAdminTheme('system')).toBe(true)
		expect(isAdminTheme('blue')).toBe(false)
		expect(isAdminTheme(undefined)).toBe(false)
	})
})
