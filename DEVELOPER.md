# Developer Guide

For documentation on developing modules, please see [the website](https://companion.free/for-developers/module-development/home)

To develop Companion itself (aka core Companion, i.e. this repo), [start here](https://companion.free/for-developers/)

## TL;DR

For core Companion:

```bash
yarn install
yarn dev
```

Connect to it at http://localhost:8000/

Performance Video fork notes:

- Config lives in `~/companion-config` (override with `COMPANION_CONFIG_BASEDIR` or `--config-dir`), never inside
  the checkout. Older runs from a checkout at `~/companion` wrote `~/companion/v5.1`; move it with
  `mkdir -p ~/companion-config && mv ~/companion/v5.1 ~/companion/machid ~/companion-config/`.
- `yarn dev` no longer reads the terminal, so pressing Return there no longer restarts Companion
  (`[tsx] Return key Restarting...`). It rebuilds the webui when `webui/build` is from a different commit.
- `yarn start:local` runs Companion once, without the file watcher, after rebuilding the webui. Use it to
  just run the app; use `yarn dev` while editing backend code.

Optionally, in another terminal:

```bash
# Run front end in dev mode for auto-refresh
yarn dev:webui
```

Connect to it at http://localhost:5173/

## Environment configuration

A `.env` file in the root of the repository can be used to customise the dev environment. Copy `.env.example` to get started:

```bash
cp .env.example .env
```

See `.env.example` for descriptions of available settings.

## Testing

Unit tests are written with [Vitest](https://vitest.dev/).

```bash
# Run all tests
yarn test --run

# Run tests in watch mode
yarn test
```

## Storybook

The webui has a [Storybook](https://storybook.js.org/) for developing and visually reviewing UI components in isolation.

```bash
yarn dev:storybook
```

Connect to it at http://localhost:6006/

## Linting and formatting

The project uses [ESLint](https://eslint.org/) for linting and [Prettier](https://prettier.io/) for formatting. Both are enforced via a pre-commit hook (husky + lint-staged), so code will be checked automatically before each commit.

To run them manually:

```bash
# Check for lint errors
yarn lint

# Format all files
yarn format
```

## Type checking

TypeScript types across all packages can be checked without running the full build:

```bash
yarn check-types
```

## Docs

The documentation is built with [Docusaurus](https://docusaurus.io/) and lives in the `docs/` package. The same content is bundled into Companion and published at https://companion.free.

```bash
yarn dev:docs
```

Connect to it at http://localhost:4000/

## Built-in connection modules (PV fork)

`modules/` holds the connection modules PV Companion ships with: `pvllc-atem-dials` (source, built by
`modules/pvllc-atem-dials/build.mjs`) and `pvllc-control-center` (the Control Center module's built package; see its
README to update it). In development Companion loads them from `modules/`, in packaged builds from
`dist/builtin-modules` (`tools/build/package.mts`).

A built-in module that lists another id in `legacyIds` replaces it: any other built-in module with that id (an old copy
left in `modules/`, e.g. `modules/rs6-presets`) is ignored with a warning, and connections on the old id are moved to
the built-in module at start-up ("Moving connection ... to built-in pvllc-control-center" in the log). Check
`git status modules/` for untracked folders; anything there loads as a built-in module.
