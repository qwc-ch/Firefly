# Firefly - Astro blog theme template

## Quick reference

```bash
pnpm install          # pnpm only (enforced by preinstall hook, .npmrc)
pnpm dev              # dev server → localhost:4321
pnpm build            # generate-icons → astro build → pagefind --site dist
pnpm check            # astro check (TS checking)
pnpm type-check       # tsc --noEmit --isolatedDeclarations
pnpm lint             # biome check --write ./src
pnpm format           # biome format --write ./src
pnpm new-post <name>  # scaffold a blog post at src/content/posts/
pnpm preview          # serve dist/ locally
pnpm icons            # standalone icon generation (part of build too)
```

## Build quirks

- `pnpm build` = **3 sequential steps**: icons → astro build → pagefind. All required for a complete build.
- CI runs `pnpm astro check` and `pnpm astro build` separately (no icons/pagefind). Deploy workflow uses `pnpm run build` (full pipeline).
- Build drops `console.log`/`debugger` via esbuild.
- `sharp` required for image optimization (Astro dependency).
- `trailingSlash: "always"` in Astro config.
- OG image generation (`generateOgImages`) is expensive — disable during dev.
- Two experimental features in astro.config: `rustCompiler: false` (Rust compiler), `queuedRendering: true`.

## Config

**All site customization** in `src/config/*.ts`, re-exported via `src/config/index.ts`. No `.env` used.
Pages disabled via `siteConfig.pages.*` booleans return 404.
Available pages: friends, sponsor, guestbook, bangumi, gallery. Bangumi data fetched at build time.

## Content

- Posts: `src/content/posts/*.{md,mdx}`. Schema at `src/content.config.ts:7-31`.
- Spec pages: `src/content/spec/*.{md,mdx}`.
- Post frontmatter fields beyond the basics: `updated`, `author`, `sourceLink`, `licenseName`, `licenseUrl`, `password`, `passwordHint`, `comment` (default true), `pinned`.

## i18n

`src/i18n/` — enum `I18nKey`, translations per language. Fallback chain: configured `siteConfig.lang` → `zh_CN` → `en`.

## Biome (lint + format)

- **Tabs** for indent, **double quotes**, `organizeImports` on save (via `assist.actions.source.organizeImports`).
- Ignores: `src/**/*.css`, `src/public/**/*`, `dist/`, `node_modules/`, `src/constants/icons.ts` (auto-generated).
- Overrides for `.svelte`/`.astro`/`.vue`: `noUnusedVariables`/`noUnusedImports`/`useConst`/`useImportType` disabled.
- CI: `pnpm exec biome ci ./src --reporter=github` (all workflows run on `main` branch).

## Testing

No test framework. Verification: `pnpm check && pnpm build`.

## Path aliases (tsconfig)

`@components/*`, `@assets/*`, `@constants/*`, `@utils/*`, `@i18n/*`, `@layouts/*`, `@/*` → `src/*`.

## CI / Deploy

- Build check (matrix: node 22, 23): `pnpm astro check` and `pnpm astro build` separately.
- Biome CI: runs on `main` branch. Build/deploy CI: runs on `main` branch.
- Vercel: `pnpm build`, output `dist/`, framework `astro`. Security headers in `vercel.json`.
- Cloudflare: `wrangler.toml` serves `dist/` as static assets.
- GitHub Pages: deploy workflow pushes `dist/` via `actions/upload-pages-artifact`.
- `pnpm install --frozen-lockfile` in CI.
- `.claude` in `.gitignore`; `.npmrc` sets `manage-package-manager-versions = true`.