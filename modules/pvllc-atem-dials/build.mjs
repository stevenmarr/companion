import * as esbuild from 'esbuild'

// Bundle Companion's base library into the module. Leave atem-connection external so its
// socket child file and the in-process threadedclass path keep working.
await esbuild.build({
	entryPoints: ['src/main.ts'],
	bundle: true,
	platform: 'node',
	format: 'esm',
	outfile: 'dist/main.js',
	sourcemap: true,
	target: 'node22',
	external: ['atem-connection'],
	logLevel: 'info',
})
