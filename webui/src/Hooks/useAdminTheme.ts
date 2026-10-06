import { useEffect, useState, useSyncExternalStore } from 'react'
import type { AdminTheme } from '@companion-app/shared/Model/UserConfigModel.js'

/** Remembered on this browser so the next page load can paint dark before the config arrives. */
export const ADMIN_THEME_STORAGE_KEY = 'companion-admin-theme'

export function isAdminTheme(value: unknown): value is AdminTheme {
	return value === 'light' || value === 'dark' || value === 'system'
}

/** `system` follows this computer. Anything else, including a setting that has not loaded yet, stays light. */
export function resolveAdminTheme(preference: string | undefined, systemDark: boolean): 'light' | 'dark' {
	if (preference === 'dark') return 'dark'
	if (preference === 'system') return systemDark ? 'dark' : 'light'
	return 'light'
}

export function applyAdminTheme(resolved: 'light' | 'dark', preference: AdminTheme | undefined): void {
	const root = document.documentElement
	root.dataset.theme = resolved
	root.dataset.coreuiTheme = resolved
	root.style.colorScheme = resolved
	publishResolvedAdminTheme(resolved)

	if (!preference) return
	try {
		localStorage.setItem(ADMIN_THEME_STORAGE_KEY, preference)
	} catch {
		// Private mode can refuse storage. The setting still applies for this visit.
	}
}

let resolvedAdminTheme: 'light' | 'dark' =
	typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
const resolvedAdminThemeListeners = new Set<() => void>()

function publishResolvedAdminTheme(theme: 'light' | 'dark'): void {
	if (resolvedAdminTheme === theme) return
	resolvedAdminTheme = theme
	for (const listener of resolvedAdminThemeListeners) listener()
}

/** The theme currently painted, so editors can follow Appearance without reading the setting themselves. */
export function useResolvedAdminTheme(): 'light' | 'dark' {
	return useSyncExternalStore(
		(listener) => {
			resolvedAdminThemeListeners.add(listener)
			return () => resolvedAdminThemeListeners.delete(listener)
		},
		() => resolvedAdminTheme
	)
}

/**
 * Paint the admin GUI from Settings → Appearance.
 * Until the saved setting arrives, keep whatever the page already painted (including the early script).
 */
export function useAdminTheme(preference: string | undefined): void {
	const [systemDark, setSystemDark] = useState(
		() => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
	)

	useEffect(() => {
		const query = window.matchMedia('(prefers-color-scheme: dark)')
		const onChange = () => setSystemDark(query.matches)
		query.addEventListener('change', onChange)
		return () => query.removeEventListener('change', onChange)
	}, [])

	useEffect(() => {
		if (!isAdminTheme(preference)) return
		applyAdminTheme(resolveAdminTheme(preference, systemDark), preference)
	}, [preference, systemDark])
}
