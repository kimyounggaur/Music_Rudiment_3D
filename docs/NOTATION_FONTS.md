# Book notation font provenance

BookNotation uses VexFlow 5.0.0's public `vexflow/core` entry and the exact WOFF2 data included by its `vexflow/bravura` entry. No CDN font request is made. The generated module is a reproducible extraction of the installed, lockfile-pinned package, not a modified or subset font.

Run `node scripts/extract-notation-fonts.mjs --check` to compare source bytes, recorded SHA-256 and the generated payload. Run without `--check` only to reproduce it from VexFlow 5.0.0. A package version or byte change deliberately fails until reviewed.

| Font | Bytes | SHA-256 |
|---|---:|---|
| Bravura | 247200 | `5c25278c208ca455dc7c3c0c95d833e134aca6d740a023767af50d0dfa06ef82` |
| Academico | 22704 | `363caf009818b9cebc7a2644d96b5dc10a20d3b5e557afdb4fb1a9a53d57e329` |
| Academico bold | 23496 | `575c2e30fcf7dd9363e49890644b2ed23b6b518c9866aadb5370d470473297b6` |

Bravura and Academico are SIL Open Font License 1.1 fonts, separate from VexFlow's MIT software license. Bravura has Steinberg's 2019 copyright and reserved font name; Academico regular/bold have Steinberg's 2022 copyright and reserved font name. The combined full notices are served at `/licenses/book-notation-fonts.txt`. Their official sources are [Bravura's license](https://raw.githubusercontent.com/vexflow/vexflow-fonts/main/bravura/LICENSE.txt) and [Academico's license](https://raw.githubusercontent.com/vexflow/vexflow-fonts/main/academico/LICENSE.txt).

The live document registers each font once and waits for both FontFace load promises and FontFaceSet verification. A standalone SVG serialization injects these same data URLs into its own `@font-face` rules, and includes the full notices in readable SVG metadata. This is necessary because browser FontFace registration is not serialized with an SVG element, and VexFlow 5 renders music glyphs as SVG text.

Font-ready checks and reproducibility checks do not establish visual correctness. Real browser SVG, page texture, sixteen-note readability, and live-to-printed registration still require the application's G1/V11 visual checks.
