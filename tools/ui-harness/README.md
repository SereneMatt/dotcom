# UI harness

Inspect a running website in interactive viewports side by side. Choose sizes from
a pinned Chromium DevTools catalog, add custom dimensions, and save a workspace
for each project. Node.js 22 or newer is required. The CLI has no runtime package
dependencies.

This package is developed inside dotcom and is not published yet. The package
name `@serenematt/ui-harness` is provisional.

## Try it in dotcom

From the dotcom repository, install its tools and start the HTTPS proxy once:

```sh
nub install
nub run https:setup
```

Complete Portless's administrator prompt in your terminal. This trusts its local
certificate authority and starts the loopback proxy on port 443. Portless requires
Node.js 24 or newer. Then start the development server:

```sh
nub run preview
```

In another terminal, open the harness:

```sh
nub run harness
```

The workspace opens at `https://harness.dotcom.localhost`, with previews served
from `https://dotcom.localhost`. Dotcom's checked-in
`ui-harness.config.json` supplies the target URL and starting sizes.

Choose **Display scale → 100%** to inspect a preview at its actual size. **Fit**
scales its display without changing its layout dimensions. Scroll and navigate
inside each preview independently. **Reset all** returns every preview to the
project URL.

Select **Save settings** to write the current URL, selected viewports, and scale
to the configuration file. Changes stay in memory until you save.

## Use another project

Start that project's development server. From its directory, run the CLI using
its absolute path:

```sh
node /path/to/dotcom/tools/ui-harness/bin/ui-harness.js http://localhost:3000
```

The default settings file is `ui-harness.config.json` in the current directory.
Pass `--config PATH` to select another file. Pass `--port 0` to select an available
workspace port or `--no-open` to print the workspace URL without opening a browser.
When launched through Portless, the harness uses its `PORT` and `PORTLESS_URL`
environment variables automatically. For another reverse proxy, pass its public
workspace origin through `--origin https://harness.example.localhost`.

To test the npm package locally, run `npm pack` from `tools/ui-harness`. Then run
the resulting tarball with either runner:

```sh
npx --yes --package=/absolute/path/serenematt-ui-harness-0.1.0.tgz ui-harness http://localhost:3000
pnpm --package=/absolute/path/serenematt-ui-harness-0.1.0.tgz dlx ui-harness http://localhost:3000
```

For `nubx`, install the tarball into a separate test project, then run its local
binary:

```sh
npm install --save-dev /absolute/path/serenematt-ui-harness-0.1.0.tgz
nubx --no-install ui-harness http://localhost:3000
```

`nubx` 0.9.3 rejects a local tarball passed directly to `--package`. Once the
package is published, the intended registry commands are `npx @serenematt/ui-harness`,
`nubx --package @serenematt/ui-harness ui-harness`, and
`pnpm dlx @serenematt/ui-harness`, followed by the target URL.

## Use HTTPS URLs without ports

Use [Portless](https://portless.sh/) to serve both your project and the harness
through a local HTTPS proxy. Once Portless is installed and its proxy is trusted,
start your project through it:

```sh
portless myapp npm run dev
```

In another terminal, start the harness through the same proxy:

```sh
portless harness.myapp node /path/to/ui-harness/bin/ui-harness.js https://myapp.localhost
```

Open `https://harness.myapp.localhost`. The target project and the workspace
use HTTPS, including browser certificate validation. Portless supplies each
application's internal `PORT`. Configure your development server to honor that
variable when its framework is not automatically supported by Portless.

If the setup needs administrator authentication, run `portless proxy start --port 443`
in an interactive terminal. Use `portless doctor` to check proxy health and system
certificate trust. See [Portless HTTPS setup](https://portless.sh/https).

The standalone harness also accepts URLs served by another proxy. HTTPS without
an explicit port uses port 443. Portless is an optional development tool, not a
runtime dependency of the reusable package. Dotcom's `preview:http` and
`harness:http` scripts provide a direct HTTP fallback.

## Handle blank previews

Open **Preview blank or blocked?** and select **Open project directly**. Confirm
that the target development server is running.

If the project forbids embedding, allow the printed workspace origin in its
development-only `Content-Security-Policy: frame-ancestors` configuration and
adjust any conflicting `X-Frame-Options` header. Keep production policies separate.
The browser does not reliably report frame-load failures to the parent workspace.

## Develop the package

From `tools/ui-harness`, install the test dependencies and run the browser tests:

```sh
npm ci
npx playwright install chromium
npm test
```

To use an existing Chromium installation, set `CHROME_PATH` to its executable
when running the tests. The application does not require Playwright at runtime.

To update the catalog, pass a reviewed Chromium DevTools commit SHA:

```sh
node scripts/update-catalog.js FULL_COMMIT_SHA
```

Review the generated dimensions and upstream license notice before releasing.
The importer includes both orientations and expanded foldable sizes, removes
duplicate dimension pairs, and records the source revision. See
[workspace reference](docs/reference.md) for the configuration format and limits.
