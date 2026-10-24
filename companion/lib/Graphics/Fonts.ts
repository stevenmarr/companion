import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isPackaged } from '../Resources/Util.js'

export interface FontDefinition {
	name: string
	pathOnDisk: string
}

/**
 * Generate full path to a font file, handling both packaged and non-packaged environments
 */
function generateFontUrl(fontFilename: string): string {
	const fontPath = isPackaged() ? 'assets/Fonts' : '../../../assets/Fonts'
	// we could simplify by using import.meta.dirname
	return fileURLToPath(new URL(path.join(fontPath, fontFilename), import.meta.url))
}

/**
 * The supported fonts for button drawing, these are loaded into the renderer at startup, and can be pulled by clients for preview rendering
 *
 * Fork additions (SIL OFL 1.1, vendored under assets/Fonts with OFL-*.txt):
 * - Space Grotesk Bold → Companion-brand (HOME / section headers; Performance Video software line)
 * - Barlow Semi Condensed SemiBold/Bold → Companion-condensed-* (when Arimo overflows a key)
 * Dense labels stay Companion-sans (Arimo); live values stay Companion-mono. No Montserrat.
 */
export const FONT_DEFINITIONS = [
	{ pathOnDisk: generateFontUrl('Arimo-Regular.ttf'), name: 'Companion-sans' },
	// typos:disable-line wdth is part of the filename
	{ pathOnDisk: generateFontUrl('NotoSansMono-wdth-wght.ttf'), name: 'Companion-mono' },
	{ pathOnDisk: generateFontUrl('SpaceGrotesk-Bold.ttf'), name: 'Companion-brand' },
	{ pathOnDisk: generateFontUrl('BarlowSemiCondensed-SemiBold.ttf'), name: 'Companion-condensed-semibold' },
	{ pathOnDisk: generateFontUrl('BarlowSemiCondensed-Bold.ttf'), name: 'Companion-condensed-bold' },
	{ pathOnDisk: generateFontUrl('NotoSansSymbols-wght.ttf'), name: 'Companion-symbols1' },
	{ pathOnDisk: generateFontUrl('NotoSansSymbols2-Regular.ttf'), name: 'Companion-symbols2' },
	{ pathOnDisk: generateFontUrl('NotoSansMath-Regular.ttf'), name: 'Companion-symbols3' },
	{ pathOnDisk: generateFontUrl('NotoMusic-Regular.ttf'), name: 'Companion-symbols4' },
	{ pathOnDisk: generateFontUrl('NotoSansLinearA-Regular.ttf'), name: 'Companion-symbols5' },
	{ pathOnDisk: generateFontUrl('NotoSansLinearB-Regular.ttf'), name: 'Companion-symbols6' },
	{ pathOnDisk: generateFontUrl('NotoSansGurmukhi-Regular.ttf'), name: 'Companion-gurmukhi' },
	{ pathOnDisk: generateFontUrl('NotoSansSC-Regular.ttf'), name: 'Companion-simplified-chinese' },
	{ pathOnDisk: generateFontUrl('NotoSansKR-Regular.ttf'), name: 'Companion-korean' },
	{ pathOnDisk: generateFontUrl('NotoColorEmoji-compat.ttf'), name: 'Companion-emoji' },
	{ pathOnDisk: generateFontUrl('pf_tempesta_seven.ttf'), name: '5x7' },
]
