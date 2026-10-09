# Third-party notices

Mermaid Styler includes third-party software. Each dependency keeps its own license and copyright terms. The repository MIT license applies to its own code.

## Mermaid

Mermaid is used as the browser-side diagram renderer.

- Project: https://github.com/mermaid-js/mermaid
- License: MIT
- License text: [LICENSES/MERMAID-MIT.txt](LICENSES/MERMAID-MIT.txt)

Mermaid Styler is an independent project and is not an official Mermaid product. The Mermaid name and project attribution are used to identify the rendering library.

## Astro and DOMPurify

- Astro 7.3.5 is the build framework (MIT, including upstream notices in its license).
- DOMPurify 3.4.16 sanitizes labels (dual Apache-2.0 / MPL-2.0; distributed under the Apache-2.0 option).
- Mermaid 11.17.0 renders diagrams (MIT).

Each build generates `dist/third-party-licenses.txt` from installed production
packages and their license/notice files. It is published alongside the site at
`/third-party-licenses.txt`, including transitive dependencies conservatively.
Run `npm ci` before building so those texts correspond to the lockfile.

## Fonts and icons

No font files are bundled. IBM Plex names are preferred local faces with system
fallbacks; no font CDN is required. Interface icons are authored SVG geometry
in `src/components/ui/Icon.astro` and use the project's MIT license.

## Dependency review

New dependencies or copied assets must have compatible terms and retained
attribution. Check generated notices when updating dependencies; the generator
is a distribution aid and does not replace review of nonstandard licenses.

The project must not copy Mermaid documentation, logos, or artwork without checking the applicable terms. The MIT license for the Mermaid software does not automatically grant rights to third-party branding or unrelated assets.
