# mGBA Web core build

This is an MPL-2.0 C bridge derived from `liru55/mgba-celio-web`
`de2c446e7369610f3ab402dd775e81d6a1661608`, compiled against
`onikoro334274-cell/mGBA_celio_edition`
`dee555365ec5e4a2d21ee24f6f409412fa62cd94` (`rom64`).
The core source is in `../mgba-celio-rom64-source.tar.gz`.
The original bridge source is in `../mgba-celio-web-source.tar.gz`.

Local build verified with Emscripten **4.0.15** (emscripten-releases compiler build
`b412b6307e541b93dd93f01b61181e15c17302ec`), CMake **3.31.6**, Ninja **1.11.1**.
No Qt, SDL, network client, system BIOS, scripting engine, or external assets
are built into the core. The standard Emscripten runtime and bundled mGBA
dependencies are used. See the upstream licenses in the source archives.

Extract the core source archive into a build directory outside the published
Web directory. Activate the pinned Emscripten SDK and put CMake/Ninja on PATH.
From this `mgba-web-port` directory, use the following (replace the paths):

```sh
emcmake cmake -S . -B /path/to/build -G Ninja -DCMAKE_BUILD_TYPE=Release -DMGBA_SOURCE=/path/to/extracted/mgba
cmake --build /path/to/build --parallel 6
```

The output is `mgba.js` and `mgba.wasm`. Place both in `web/cores/mgba/`;
record their SHA-256 in `SOURCES.json`; run the core, browser, feature and link
tests; regenerate `offline-manifest.js` and the Web source zip.

Changes in this port: `link.h` exposes only the required SIO/timer/IRQ registers
and callbacks. `bridge.c` resets these callbacks on ROM close. All network
transport is in separately licensed JavaScript (`src/celio-device.js`, GPLv3,
and `src/room-link.js`, MPL-2.0). The bridge itself never sends data.

The shipped archive contains the Web compiler dependency closure, required build inputs, and upstream notices. Rebuilding this source subset produced identical JS/WASM hashes; see ../build-evidence.json. GUI artwork, fonts and test cartridges are not included.

To check a newer upstream revision without replacing this distribution, see
`../../CORE_UPDATES.md`. The compiler build hash above belongs to
`emscripten-releases`, not the emsdk installer Git repository. The candidate
recipe in `upstream.json` pins those two repositories separately.
