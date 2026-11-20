# Contributing

This repository holds the Al Bashiroh website and admin panel. It follows
Nara's feature model: read [`AGENTS.md`](./AGENTS.md),
[`ARCHITECTURE.md`](./ARCHITECTURE.md) and
[`docs/feature-model.md`](./docs/feature-model.md) before changing structure.

Security problems are never reported in public issues; see
[`SECURITY.md`](./SECURITY.md).

## Setup

- Node.js 22 or newer, with the npm it ships (10.9.8).
- `npm ci`, then `cp .env.example .env` and `npm run setup`.
- `git config core.hooksPath .githooks` once per clone: the pre-push hook runs
  `npm run verify`, the same gate pull-request CI runs.

`npm ci` works with npm 10.9.8, but adding or changing a dependency does not
(it stops with `Cannot read properties of null (reading 'edgesOut')`). Run that
one step with npm 11: `npx npm@11 install <package>`.

## Pull requests

- One pull request fixes one whole problem: the code, its tests and its
  documentation together. No test-only follow-ups, no hardening split away from
  the feature it hardens.
- Work that depends on an open pull request is a stacked pull request, branched
  from it and merged after it.
- Branch names carry a Conventional type: `feat/ppdb-export`,
  `fix/gallery-order`, `chore/ci-cache`, `docs/deploy-notes`.
- The pull request title is a [Conventional Commit](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), because the
  squash-merge uses it as the commit on `main` and release-please builds the
  changelog from it. Mark breaking changes with `!`.
- Describe what changed, why, and how it was verified. A change to a screen
  carries before and after screenshots at desktop and phone width.
- Commits are signed, so GitHub shows them as Verified.
- The author squash-merges once the review or QA passed and the required CI is
  green. `main` does not require branches to be up to date; rebase only for
  real conflicts.

## Checks

```bash
npm run verify            # pull-request gate: Vue typecheck, fast tests, build, architecture doctor
npm run check             # the full suite: server and Vue typecheck, every test, doctor
npx vitest run <path>     # one file or folder while iterating
```

Pull-request CI runs `verify`. A push to `main` runs the full tests, the
production build, the architecture doctor and the production serving and
startup checks.

Tests use synthetic data only. Never commit real names of staff, students or
applicants, database files, uploads, or `.env` files.

## Releases

[release-please](https://github.com/googleapis/release-please) keeps a release
pull request open that bumps the version in `package.json` and
`package-lock.json` and writes `CHANGELOG.md` from the `feat:` and `fix:`
commits on `main`. Merging it tags the release. Do not edit the version or the
changelog by hand. Releases and production deployments are done by the release
owner.
