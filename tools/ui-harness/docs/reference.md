# Workspace reference

## Configuration

```json
{
	"version": 1,
	"url": "http://localhost:4173/",
	"viewports": [
		{ "width": 390, "height": 664 },
		{ "width": 768, "height": 1024 },
		{ "width": 1280, "height": 720 },
		{ "width": 1440, "height": 900 }
	],
	"scale": "fit"
}
```

| Field | Accepted values |
| --- | --- |
| `version` | `1` |
| `url` | HTTP or HTTPS URL without embedded credentials; HTTP is assumed when the scheme is omitted |
| `viewports` | 1–128 unique width and height pairs, in CSS pixels |
| `width`, `height` | Integers from 1 through 10000 |
| `scale` | `"fit"` or a number from `0.1` through `1` |

A CLI URL overrides the saved URL for the current session. **Save settings**
persists that override. Removing a preview discards its page state. Adding another
size or changing scale preserves the remaining previews.

## Catalog and browser coverage

The package includes 74 unique dimensions from the Chromium DevTools revision
recorded in `data/chromium-viewports.json`. The four starting dimensions are a
chosen selection, not a web standard. Sizes outside the Chromium catalog carry a
**STARTER** or **CUSTOM** label.

The browser hosting the workspace renders every preview. Selecting a size does
not switch browser engines, emulate touch input, change device pixel ratio, apply
foldable hinges, or simulate mobile browser controls. Iframes for the same target
origin share browser storage; they are not separate login sessions.

Cross-origin previews support native interaction, but the harness cannot inspect
their current routes or document contents. **Reset all** navigates them to the
shared project URL. Embedding policies, authentication policies, and browser
permissions can affect framed pages.

The local server binds only to `127.0.0.1`. `--port` overrides `PORT`, which defaults
to 4317. `--origin` overrides `PORTLESS_URL`; otherwise the workspace uses its listen
URL. Public origins must contain only an HTTP or HTTPS scheme and authority.

Settings writes require the configured workspace origin and a per-process token.
The server does not derive trusted origins from forwarded request headers. It
serves package assets only, not project files.

## License

The tool is MIT licensed. The Chromium-derived catalog retains its upstream
BSD-style notice in `THIRD_PARTY_NOTICES`.
