# Releasing `@escalated-dev/plugin-runtime`

Publishing a GitHub release publishes the package to npm through
[`.github/workflows/npm-publish.yml`](.github/workflows/npm-publish.yml).

## How a release publishes

1. Bump `version` in `package.json` and `package-lock.json` and the handshake
   `runtime_version` in `src/runtime.ts`, then merge to `master`.
2. Create a GitHub release with tag `v<version>` (e.g. `v0.2.1`).
3. The **Publish to npm** workflow checks out the tag and:
   - fails if `package.json` `version` does not equal the tag without its `v`;
   - builds `@escalated-dev/plugin-sdk` from its default branch (as CI does), then
     runs `npm ci`, the build and the tests;
   - checks the `npm pack` tarball contains `main`, `types` and the `bin` entry, no
     tests or CI files, and no local-path dependencies;
   - runs `npm publish --provenance --access public` (prereleases such as
     `0.3.0-rc.1` go to the `next` dist-tag).

If neither `NPM_TOKEN` nor trusted publishing is configured, the publish step logs
`skipping: NPM_TOKEN not configured` and exits 0, so the release does not go red.
A version that is already on npm is skipped the same way.

## One-time setup (pick one)

- **Token:** create an npm granular access token with read and write access to the
  `@escalated-dev` scope, then add it as the repository secret `NPM_TOKEN`
  (Settings -> Secrets and variables -> Actions).
- **Trusted publishing (no token):** on npmjs.com, add a Trusted Publisher for
  `@escalated-dev/plugin-runtime` (GitHub Actions, repository
  `escalated-dev/escalated-plugin-runtime`, workflow `npm-publish.yml`), then set the
  repository **variable** `NPM_TRUSTED_PUBLISHING` to `true`. npm only allows this
  once the package exists, so the very first publish needs the token.

## Publishing a release that already exists

After adding the secret, open Actions -> **Publish to npm** -> **Run workflow**, keep
the branch at `master`, and enter the tag.
