import type { ButtonGraphicsTextDrawElement } from '../Model/StyleLayersModel.js'

const DEFAULT_FONTS = [
	'Companion-sans',
	'Companion-symbols1',
	'Companion-symbols2',
	'Companion-symbols3',
	'Companion-symbols4',
	'Companion-symbols5',
	'Companion-symbols6',
	'Companion-gurmukhi',
	'Companion-simplified-chinese',
	'Companion-korean',
	'Companion-emoji',
]
const DEFAULT_FONTS_STR = DEFAULT_FONTS.join(',')

export type CompanionFontId = ButtonGraphicsTextDrawElement['font']
export type CompanionFontWeight = ButtonGraphicsTextDrawElement['weight']

/** Registered face names (must match companion/lib/Graphics/Fonts.ts FONT_DEFINITIONS). */
export const ALL_FONTS: ReadonlySet<string> = new Set([
	...DEFAULT_FONTS,
	'Companion-mono',
	'Companion-brand',
	'Companion-condensed-semibold',
	'Companion-condensed-bold',
])

function withFallback(face: string): string {
	return `${face},${DEFAULT_FONTS_STR}`
}

/**
 * Resolve a module/UI font id to a CSS font-family list for Skia / browser preview.
 * Unknown ids fall back to companion-sans so modules degrade safely on older hosts.
 *
 * Deck guidance (PVLLC T-Bar): dense labels = companion-sans Bold; live values =
 * companion-mono Bold; HOME/section headers = companion-brand; overflow = companion-condensed.
 * No Montserrat. Prefer Bold weights on keys.
 */
export function resolveFontName(
	fontName: CompanionFontId | undefined,
	weight: CompanionFontWeight | undefined = 'normal'
): string {
	if (!fontName) return DEFAULT_FONTS_STR

	switch (fontName) {
		case 'companion-mono':
			return 'Companion-mono'
		case 'companion-brand':
			// Space Grotesk Bold only (HOME / section headers)
			return withFallback('Companion-brand')
		case 'companion-condensed':
			return withFallback(weight === 'bold' ? 'Companion-condensed-bold' : 'Companion-condensed-semibold')
		case 'companion-sans':
		default:
			return DEFAULT_FONTS_STR
	}
}
