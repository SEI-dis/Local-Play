# ManicEMU standard skins — CC BY 4.0

Attribution: **Manic EMU / Manic-EMU contributors**.
Titles: ManicEMU GB / GBC / MD Skin Standard; ManicEmu GBA / NES / SNES / DS Skin Standard.

Source: [Manic-EMU/ManicEMUSkins](https://github.com/Manic-EMU/ManicEMUSkins/tree/63c04f92febba461d10ea16ef00b0f76199a5b20),
commit `63c04f92febba461d10ea16ef00b0f76199a5b20` (archived upstream).
The original repository README is retained in `UPSTREAM-README.md`.
License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
The upstream license, including its warranty disclaimer, is retained byte-for-byte
at [ManicEMUSkins-CC-BY-4.0.txt](../../licenses/ManicEMUSkins-CC-BY-4.0.txt).

These seven explicitly selected standard skins are licensed artwork, separate from
the AGPL application code. No additional legal restrictions or DRM are applied.
This is an unofficial Web adaptation; no endorsement by Manic EMU or any console
manufacturer is claimed. The license does not grant trademark/patent rights or
rights to user ROMs, covers or unrelated skins.

## Changes in PalmoEMU (2026-10-09)

- Retained the artwork, creator labels and original `info.json` bytes.
- Rendered referenced single-page PDFs to transparent PNG using the bundled PDF.js,
  at up to 2× resolution, capped at 2048 pixels. Normalized layouts with
  `src/skin-format.js`; all six phone/tablet and portrait/landscape variants retained.
- Packaged referenced PDFs and `info.json` with the retained license, attribution
  and upstream README in each source ZIP. Removed macOS
  resource forks and the unused GB `iphone_standard_landscape-1.pdf`.
- Application previews use an original PalmoEMU test screen, without game artwork.
  Skin handling follows [the Web compatibility limits](../../SKIN_COMPATIBILITY.md).

Original download hashes, selected titles, local source archives, converted files
and hashes are in [BUNDLED_SKINS.json](../../BUNDLED_SKINS.json). The original
`.manicskin` download is a ZIP; these source ZIPs are filtered repackages, not
byte-identical upstream downloads. No files from the newer `System.core` tree,
FLEX skins, ROMs, BIOS, keys or external fonts are included here.

## Regeneration

Install Playwright for build/test use (or set `PLAYWRIGHT_MODULE` to its location).
From `web/`, run:

```sh
node scripts/build-bundled-skins.cjs --check
```

Omit `--check` to render again. Set `BROWSER_CHANNEL=msedge` to use installed Edge.
The checked-in PNGs were rendered with Edge/PDF.js on Windows. Browser changes may
change PNG bytes, so regenerated files need a new review. This command never updates
the approval hashes. It uses a temporary local server and isolated browser context;
it does not access the user's ROMs, skin storage or browser profile.

The release check rejects added, changed or missing bundle files. Adding a skin or
updating upstream requires reviewing its specific license and materials, retaining
attribution, and updating the provenance and release review deliberately.
