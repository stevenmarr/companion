// @ts-check

/** Drop the standalone ATEM module. It is not part of the solution `tsc --build` checks. */
function outsideAtemModule(filenames) {
	return filenames.filter((filename) => !filename.includes('modules/pvllc-atem-dials'))
}

/** @type {import('lint-staged').Configuration} */
export default {
	'*.{ts,tsx,cts,mts,js,jsx}': (filenames) => {
		const files = outsideAtemModule(filenames)
		if (files.length === 0) return 'node -e "process.exit(0)"'
		return `eslint ${files.map((file) => JSON.stringify(file)).join(' ')}`
	},
	'*.{json,css,scss,md,yaml,yml}': (filenames) => {
		const files = outsideAtemModule(filenames)
		if (files.length === 0) return 'node -e "process.exit(0)"'
		return `prettier --check ${files.map((file) => JSON.stringify(file)).join(' ')}`
	},

	// A change to any TypeScript file requires a full project type-check.
	// tsc uses project references (`--build`) and checks across files, so it
	// must run once over the whole project rather than on the staged files.
	// Returning a function (with no filenames appended) achieves this.
	'*.{ts,tsx,cts,mts}': (filenames) => {
		if (outsideAtemModule(filenames).length === 0 && filenames.length > 0) return 'node -e "process.exit(0)"'
		return 'tsc --build'
	},
}
