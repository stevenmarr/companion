import semver from 'semver'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleInfo, ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { isSomeModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'
import { getHelpPathForInstalledModule } from './ModuleScanner.js'
import type { SomeModuleVersionInfo } from './Types.js'

/**
 * Information about a module
 */
export class InstanceModuleInfo {
	readonly moduleType: ModuleInstanceType
	readonly id: string

	devModule: SomeModuleVersionInfo | null = null

	builtinModule: SomeModuleVersionInfo | null = null

	installedVersions: Record<string, SomeModuleVersionInfo | undefined> = {}

	constructor(moduleType: ModuleInstanceType, id: string) {
		this.moduleType = moduleType
		this.id = id
	}

	getVersion(versionId: string | null): SomeModuleVersionInfo | null {
		if (versionId === 'dev') return this.devModule
		if (versionId === 'builtin') return this.builtinModule

		if (versionId === null) return null // TODO - is this correct?

		return this.installedVersions[versionId] ?? null
	}

	getLatestVersion(isBeta: boolean): SomeModuleVersionInfo | null {
		let latest: SomeModuleVersionInfo | null = null
		for (const version of Object.values(this.installedVersions)) {
			if (!version || version.isBeta !== isBeta) continue
			if (!isSomeModuleApiVersionCompatible(this.moduleType, version.manifest.runtime.apiVersion)) continue
			if (!latest || semver.compare(version.versionId, latest.versionId) > 0) {
				latest = version
			}
		}

		return latest
	}

	/**
	 * PV fork: the built-in copy of a connection module (repo modules/, e.g. pvllc-control-center) wins over an
	 * imported or store copy of the same module that is not newer. Otherwise an old imported package (0.11.0) shadows
	 * the built-in (0.12.0): new connections get it, and Manage Modules shows its name and help.
	 */
	builtinSupersedesInstalled(): boolean {
		const builtinVersion = this.#builtinVersion()
		if (!builtinVersion) return false
		const latest = this.getLatestVersion(false)
		return !latest || semver.gte(builtinVersion, semver.coerce(latest.versionId)?.version ?? latest.versionId)
	}

	/** PV fork: is this installed version older than the built-in copy of the same module? */
	isSupersededByBuiltin(versionId: string | null | undefined): boolean {
		if (!versionId || versionId === 'builtin' || versionId === 'dev') return false
		const builtinVersion = this.#builtinVersion()
		const installed = semver.valid(semver.coerce(versionId))
		if (!builtinVersion || !installed) return false
		return semver.lt(installed, builtinVersion)
	}

	#builtinVersion(): string | null {
		if (!this.builtinModule || this.builtinModule.manifest.type !== 'connection') return null
		return semver.valid(semver.coerce(this.builtinModule.manifest.version)) ?? null
	}

	toClientJson(): ClientModuleInfo | null {
		const builtinWins = this.builtinSupersedesInstalled()
		const stableVersion = builtinWins ? this.builtinModule : this.getLatestVersion(false)
		const betaVersion = this.getLatestVersion(true)

		const baseVersion =
			stableVersion ?? betaVersion ?? Object.values(this.installedVersions)[0] ?? this.builtinModule ?? this.devModule
		if (!baseVersion) return null

		return {
			moduleType: this.moduleType,

			display: baseVersion.display,

			devVersion: translateStableVersion(this.moduleType, this.devModule),
			builtinVersion: translateStableVersion(this.moduleType, this.builtinModule),

			stableVersion: translateStableVersion(this.moduleType, stableVersion),
			betaVersion: translateStableVersion(this.moduleType, betaVersion),

			installedVersions: Object.values(this.installedVersions)
				.filter((v): v is SomeModuleVersionInfo => v !== undefined)
				.map((v) => translateReleaseVersion(this.moduleType, v)),
		}
	}
}

function translateStableVersion(
	moduleType: ModuleInstanceType,
	version: SomeModuleVersionInfo | null
): ClientModuleVersionInfo | null {
	if (!version) return null

	const allowMultipleInstances =
		version.manifest.type === 'surface' ? (version.manifest.allowMultipleInstances ?? false) : false

	if (version.versionId === 'builtin') {
		return {
			displayName: 'Builtin',
			isLegacy: false,
			isBeta: false,
			helpPath: getHelpPathForInstalledModule(moduleType, version.manifest.id, version.versionId),
			versionId: 'builtin',
			allowMultipleInstances,
		}
	} else if (version.versionId === 'dev') {
		return {
			displayName: 'Dev',
			isLegacy: false,
			isBeta: false,
			helpPath: getHelpPathForInstalledModule(moduleType, version.manifest.id, version.versionId),
			versionId: 'dev',
			allowMultipleInstances,
		}
	} else {
		return {
			displayName: `Latest ${version.isBeta ? 'Beta' : 'Stable'} (v${version.versionId})`,
			isLegacy: version.isLegacy,
			helpPath: getHelpPathForInstalledModule(moduleType, version.manifest.id, version.versionId),
			isBeta: version.isBeta,
			versionId: version.versionId,
			allowMultipleInstances,
		}
	}
}

function translateReleaseVersion(
	moduleType: ModuleInstanceType,
	version: SomeModuleVersionInfo
): ClientModuleVersionInfo {
	return {
		displayName: `v${version.versionId}`,
		isLegacy: version.isLegacy,
		isBeta: version.isBeta,
		helpPath: getHelpPathForInstalledModule(moduleType, version.manifest.id, version.versionId),
		versionId: version.versionId,
		allowMultipleInstances:
			version.manifest.type === 'surface' ? (version.manifest.allowMultipleInstances ?? false) : false,
	}
}
