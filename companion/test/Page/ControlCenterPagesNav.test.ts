import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// PV fork: "Control Center pages" has its own screen in the left menu (BUILD), so it is not only at the bottom of
// Buttons → Pages tab (where Steven could not find it).
const root = join(import.meta.dirname, '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('Control Center pages screen', () => {
	it('is in the left menu under BUILD, right after Pages', () => {
		const sidebar = read('webui/src/Layout/Sidebar.tsx')
		const pages = sidebar.indexOf('path="/pages"')
		const cc = sidebar.indexOf('path="/control-center-pages"')
		expect(pages).toBeGreaterThan(0)
		expect(cc).toBeGreaterThan(pages)
		expect(cc).toBeLessThan(sidebar.indexOf('name="Surfaces"'))
		expect(sidebar).toContain('name="Control Center pages"')
	})

	it('has a route, and the generated route tree knows it', () => {
		expect(read('webui/src/routes/_app/control-center-pages.tsx')).toContain(
			"createFileRoute('/_app/control-center-pages')"
		)
		expect(read('webui/src/routeTree.gen.ts')).toContain("'/control-center-pages'")
	})

	it('offers New page and On page N, and the Pages screen links to it', () => {
		const ui = read('webui/src/Buttons/ControlCenterPages.tsx')
		expect(ui).toContain('New page')
		expect(ui).toContain('On page {pageNumber}')
		expect(ui).toContain('targetPage')
		expect(read('webui/src/Pages/PageBrowser.tsx')).toContain('to="/control-center-pages"')
	})
})
