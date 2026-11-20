import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, test } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { InstanceModules } from '../../lib/Instance/Modules.js'

// PV fork: modules/pvllc-control-center lists rs6-presets in legacyIds. An old untracked modules/rs6-presets must not
// load as a second built-in connection module, and connections on rs6-presets are pointed at the replacement.

const repoBuiltin = path.resolve(import.meta.dirname, '../../../modules/pvllc-control-center')

function fakeController() {
	return {
		modulesStore: { getCachedStoreList: () => ({}) },
	} as any
}

function fakeRouter() {
	return { get: () => undefined } as any
}

const tmpDirs: string[] = []
async function tmp(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pv-builtin-'))
	tmpDirs.push(dir)
	return dir
}
afterEach(async () => {
	for (const dir of tmpDirs.splice(0)) await fs.remove(dir)
})

async function writeOldRs6(dir: string): Promise<void> {
	const mod = path.join(dir, 'rs6-presets')
	await fs.mkdirp(path.join(mod, 'companion'))
	await fs.writeJson(path.join(mod, 'package.json'), { name: 'rs6-presets', version: '0.9.0', dependencies: {} })
	await fs.writeFile(path.join(mod, 'main.js'), '')
	const manifest = await fs.readJson(path.join(repoBuiltin, 'companion/manifest.json'))
	await fs.writeJson(path.join(mod, 'companion/manifest.json'), {
		...manifest,
		id: 'rs6-presets',
		name: 'RS6 Presets',
		version: '0.9.0',
		legacyIds: [],
	})
}

async function makeModules(withReplacement: boolean): Promise<InstanceModules> {
	const builtinDir = await tmp()
	const installedDir = await tmp()
	await writeOldRs6(builtinDir)
	if (withReplacement) await fs.copy(repoBuiltin, path.join(builtinDir, 'pvllc-control-center'))

	const modules = new InstanceModules(fakeController(), fakeRouter(), {
		modulesDirs: {
			[ModuleInstanceType.Connection]: installedDir,
			[ModuleInstanceType.Surface]: path.join(installedDir, 'none'),
		},
		builtinModuleDirs: {
			[ModuleInstanceType.Connection]: builtinDir,
			[ModuleInstanceType.Surface]: null,
		},
	} as any)
	await modules.initModules('')
	return modules
}

describe('built-in module replacing a legacy id', () => {
	test('repo modules/pvllc-control-center is the built module (0.11 or later) with legacy id rs6-presets', async () => {
		const manifest = await fs.readJson(path.join(repoBuiltin, 'companion/manifest.json'))
		expect(manifest.id).toBe('pvllc-control-center')
		expect(manifest.legacyIds).toContain('rs6-presets')
		expect(manifest.version).toMatch(/^0\.(1[1-9]|[2-9]\d)\./)
		expect(manifest.runtime.entrypoint).toBe('../main.js')
		expect(await fs.pathExists(path.join(repoBuiltin, 'main.js'))).toBe(true)
	})

	test('an old built-in rs6-presets is ignored and pvllc-control-center replaces it', async () => {
		const modules = await makeModules(true)
		expect(modules.getModuleManifest(ModuleInstanceType.Connection, 'pvllc-control-center', 'builtin')).toBeTruthy()
		expect(modules.getModuleManifest(ModuleInstanceType.Connection, 'rs6-presets', 'builtin')).toBeUndefined()
		expect(modules.hasModule(ModuleInstanceType.Connection, 'rs6-presets')).toBe(false)
		expect(modules.getBuiltinReplacement(ModuleInstanceType.Connection, 'rs6-presets')).toBe('pvllc-control-center')
		expect(modules.getBuiltinReplacement(ModuleInstanceType.Connection, 'pvllc-control-center')).toBeNull()
		expect(modules.getBuiltinReplacement(ModuleInstanceType.Surface, 'rs6-presets')).toBeNull()
	})

	test('without the replacement the old built-in still loads (stock behaviour)', async () => {
		const modules = await makeModules(false)
		expect(modules.getModuleManifest(ModuleInstanceType.Connection, 'rs6-presets', 'builtin')).toBeTruthy()
		expect(modules.getBuiltinReplacement(ModuleInstanceType.Connection, 'rs6-presets')).toBeNull()
	})
})
