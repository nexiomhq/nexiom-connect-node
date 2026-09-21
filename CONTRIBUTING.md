# Contributing to the Nexiom Connect Node.js SDK

Thanks for contributing to **`@nexiom/connect`**, the official Node.js SDK from Nexiom Technologies.

**License:** [Apache License 2.0](./LICENSE).

For installation and usage, see the [README](./README.md) and [examples](./examples).

## Development setup

Requires **Node.js 22 or later** and **npm**.

Fork the repository, clone your fork, and create a branch for your change:

```sh
git clone git@github.com:YOUR_USERNAME/nexiom-connect-node.git
cd nexiom-connect-node
git switch -c fix/describe-your-change

npm ci
npm run check
```

| Command | Purpose |
| --- | --- |
| `npm run build` | Build ESM, CommonJS, source maps, and TypeScript declarations with tsup |
| `npm run typecheck` | Check source types without generating files |
| `npm test` | Build, run the Node.js tests, and check TypeScript consumers |
| `npm run check` | Run source type checking and the complete test suite |
| `npm pack` | Build and create the npm package tarball |

CI runs `npm run check` on Node.js **22, 24, and 26**. Tests use mocked requests and do not require an API key or a live account.

## Project layout

```text
src/
  index.ts                    # NexiomConnect and public exports
  core/
    client.ts                 # HTTP transport, retries, timeouts, cancellation
    errors.ts                 # API, transport, and validation errors
    types.ts                  # Client options, results, request options
    validation.ts             # Shared argument validation
  services/
    emails/
      emails.ts               # Email sending
      types.ts                # Email request and response types
    contacts/
      contacts.ts             # Contact CRUD and listing
      types.ts                # Contact request and response types
      properties/
        properties.ts         # Contact property management
        types.ts              # Property request and response types
tests/
  sdk.test.mjs                # Resource contracts and transport behavior
  package.test.mjs            # Packed-package installation and compatibility
  fixtures/                   # ESM and CommonJS consumers
  types/                      # TypeScript consumer checks
examples/                     # Public usage examples
tsup.config.ts                # Package build configuration
dist/                         # Generated output; not committed
```

## Supported resources

Keep changes within the SDK's supported API surface unless a new feature has been agreed on in an issue.

| Resource | Methods |
| --- | --- |
| `nexiomConnect.emails` | `send(params, options?)` |
| `nexiomConnect.contacts` | `create(params)`, `list(params?)`, `get(id)`, `update(id, params)`, `delete(id)` |
| `nexiomConnect.contacts.properties` | `create({ name, type, fallbackValue? })`, `list(params?)`, `update(id, { fallbackValue })`, `delete(id)` |

Every method accepts request options as its final argument. Email sending also accepts `idempotencyKey` in those options.

## Conventions

| Topic | Convention |
| --- | --- |
| Initialization | `new NexiomConnect({ apiKey, baseUrl? })`; `apiKey` is required |
| Base URL | Defaults to `https://api-connect.nxiom.com/api`; versioned paths belong to each service |
| Authentication | Bearer API key; do not add organization or project scope parameters |
| Results | All methods return `{ data, error, response }`; `error` is null on success and `data` is null on failure |
| Errors | API and transport failures return `NexiomError`; locally validated invalid arguments throw `NexiomValidationError` before a request |
| Request fields | Preserve the API's field names; map property `name` to `key` and `fallbackValue` to `fallback_value` |
| Response fields | Preserve API field names, including snake_case fields; dates remain ISO strings |
| Contact updates | Require `email`; optional fields must follow the existing update contract |
| Property listing | Fetch the complete collection and apply optional `type` and `search` filters locally |
| Retries | Retry reads and idempotent email sends only; reuse the email key across attempts |
| Types | Keep resource request and response types in the resource's `types.ts` |
| Exports | Export supported public types through `src/index.ts`; keep the transport internal |
| Imports | Use relative imports with `.js` extensions for local TypeScript modules |
| Dependencies | Keep the published SDK free of runtime dependencies |

Use two-space indentation, double quotes, and semicolons. Separate methods and logical blocks with blank lines, and use braces for conditionals and loops. Keep examples short, readable, and focused on one action.

## Making a change

1. Open an issue for a new feature or a change to the public API before starting a large implementation.
2. Update the owning service and its types together. Keep shared HTTP behavior in `src/core/client.ts`.
3. Add tests for the observable behavior, including failures and invalid arguments where relevant.
4. Update the README or examples when usage changes.
5. Run `npm run check` and open a pull request against `main`.

Avoid unrelated refactors, generated files, and version bumps in ordinary pull requests.

## Testing

Use Node.js's built-in test runner and `node:assert/strict`. Inject a mock `fetch` through the client options so tests remain independent of network access.

Resource tests should verify the HTTP path, method, headers, serialized body, and returned result. Include error responses and confirm that invalid arguments do not make a request.

For example, a contact creation test can follow this pattern:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { NexiomConnect } from "../dist/index.js";

test("contacts.create sends the expected request", async () => {
  const contact = { id: "contact_123", email: "ada@example.com" };
  const requests = [];

  const nexiomConnect = new NexiomConnect({
    apiKey: "nc_test_key",
    fetch: async (url, options) => {
      requests.push({ url, options });

      return Response.json({ data: contact });
    },
  });

  const { data, error } = await nexiomConnect.contacts.create({
    email: "ada@example.com",
  });

  assert.equal(error, null);
  assert.deepEqual(data, contact);
  assert.equal(requests.length, 1);

  const { url, options } = requests[0];

  assert.equal(url, "https://api-connect.nxiom.com/api/v1/emails/contacts");
  assert.equal(options.method, "POST");
  assert.equal(options.headers.get("Authorization"), "Bearer nc_test_key");
  assert.equal(options.headers.get("Content-Type"), "application/json");
  assert.deepEqual(JSON.parse(options.body), { email: "ada@example.com" });
});
```

Run `npm test` to build before executing tests. When changing public types, update the consumers in `tests/types/`. When changing exports or build configuration, keep the packed-package tests passing for both ESM and CommonJS.

## Pull request checklist

- [ ] `npm run check` passes.
- [ ] Tests cover the changed behavior and relevant failure cases.
- [ ] Request and response types match the supported API contract.
- [ ] Public API changes are intentional and documented.
- [ ] Examples and documentation match the implementation.
- [ ] No credentials, generated `dist/` files, or package tarballs are committed.
- [ ] The change is focused and the commit history is easy to review.

## Releases

Releases are handled by maintainers. The package version, Git tag, GitHub Release, and npm version must agree: `0.1.1` → `v0.1.1` → `@nexiom/connect@0.1.1`.

From a clean, up-to-date `main` branch, update `CHANGELOG.md` and commit it before preparing the version:

```sh
npm ci
npm run check
npm version patch

git push origin main
git push origin v0.1.1
```

Use the tag created by `npm version` in the final command. Use `minor` or `major` instead of `patch` when appropriate. `npm version` updates both version files and creates the version commit and tag.

After CI passes, create and publish a GitHub Release for that tag. The [Publish workflow](./.github/workflows/publish.yml):

1. Checks out the commit associated with the release.
2. Verifies that the stable `vX.Y.Z` tag matches `package.json` and `package-lock.json`.
3. Installs dependencies and runs all checks, including packed-package tests.
4. Publishes the package to npm through the `npm` environment using trusted publishing.

Publishing a stable GitHub Release triggers npm publication; pushing a commit or tag alone does not. Drafts and prereleases are not published to npm by this workflow. If an environment approval is configured, approve the deployment to continue.

The npm package must already exist and its trusted publisher must be configured for this repository, `publish.yml`, and the `npm` environment. The first publication is a one-time maintainer setup. OIDC supplies authentication and provenance for subsequent releases; no `NPM_TOKEN` is needed.

## Troubleshooting

| Issue | What to check |
| --- | --- |
| `npm ci` reports a lockfile mismatch | Run `npm install` after changing dependencies and include `package-lock.json` in the change |
| Tests cannot find `dist/index.js` | Run `npm test`, which builds the SDK before testing |
| TypeScript consumer checks fail | Check the public exports and both ESM and CommonJS declaration files |
| Publish rejects the release tag | Match `vX.Y.Z` to both version files in the tagged commit |
| npm rejects an already published version | Prepare a new version; published versions cannot be overwritten |
