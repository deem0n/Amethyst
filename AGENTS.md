# Repository Guidelines

## Project Structure & Module Organization

Amethyst is a TypeScript Electron/Vue audio player. Main-process code lives in `src/main`, renderer UI and audio-facing frontend modules live in `src/renderer`, and shared types or logic live in `src/shared`. Platform shells are under `src/android` and `src/ios`. Static assets, fonts, icons, and app packaging resources are in `assets`. Documentation is in `docs`, release manifests are in `manifests`, and maintenance utilities are in `scripts`.

## Build, Test, and Development Commands

Use Yarn for dependency and script execution.

- `yarn`: install dependencies and app build prerequisites.
- `yarn dev`: clean `release`, build the main process, and run Electron plus the Vite renderer dev server.
- `yarn build`: build main and renderer bundles and regenerate package manifests.
- `yarn package`: create distributable desktop builds in `release/build`.
- `yarn test`: run Vitest in watch mode.
- `yarn test --run`: run the test suite once for CI-style checks.
- `yarn lint` / `yarn lint:fix`: check or auto-fix ESLint issues.
- `yarn docs`: run the Mintlify documentation site from `docs`.

## Coding Style & Naming Conventions

Code is ESM TypeScript with Vue single-file components. Follow the repository ESLint configuration: 2-space indentation, double quotes, semicolons, sorted imports via `simple-import-sort`, and Vue component tags in kebab-case inside templates. Prefer existing aliases such as `@` for renderer imports. Use PascalCase for Vue components, camelCase for functions and variables, and keep feature files near their owning view, component, node, or module.

## Testing Guidelines

Vitest is the test runner. Existing tests are colocated with implementation files and use `*.test.ts`, for example `src/renderer/logic/math.test.ts` and `src/renderer/components/BaseToolbar.test.ts`. Add focused tests for shared logic, renderer components, and behavior that can regress without manual UI inspection. Run `yarn test --run` before submitting changes; use `yarn test:browser` when browser-workspace coverage is relevant.

## Commit & Pull Request Guidelines

Recent history uses short imperative or descriptive commits, sometimes scoped conventionally, such as `Added drag&drop`, `Improve Discord RPC cover art lookup (#856)`, and `docs: fix some links`. Keep commits focused and mention the affected area when helpful. Pull requests should describe the user-visible change, list verification commands run, link related issues, and include screenshots or recordings for UI changes.

## Security & Configuration Tips

Start from `example.env` for local configuration and avoid committing secrets. Do not commit generated `release` artifacts unless a release workflow explicitly requires them. For Linux packaging work, ensure `libvips` is installed as noted in the README.
