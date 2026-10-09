"""SPDX-License-Identifier: AGPL-3.0-or-later
Convert upstream 7z .data to uncompressed USTAR for the small local reader.
Build tool dependency only: py7zr==1.1.3. No third-party decompressor ships.
Usage: python repack-core.py ORIGINAL_CORE_DIRECTORY
"""
from pathlib import Path
import hashlib, io, json, sys, tarfile, tempfile
import py7zr

ROOT = Path(__file__).resolve().parent.parent
records = {}
for source in sorted(Path(sys.argv[1]).glob('*-wasm.data')):
    target = ROOT / 'vendor/emulatorjs/cores' / source.name
    if source.resolve() == target.resolve():
        raise ValueError('Preserve the original outside the release tree')
    with tempfile.TemporaryDirectory() as temp:
        with py7zr.SevenZipFile(source) as archive:
            names = archive.getnames()
            if any('/' in n or '\\' in n or n in ('', '.', '..') for n in names):
                raise ValueError('Unexpected core archive paths')
            archive.extractall(temp)
        members = []
        with tarfile.open(target, 'w', format=tarfile.USTAR_FORMAT) as out:
            for file in sorted(Path(temp).iterdir()):
                if not file.is_file() or file.is_symlink():
                    raise ValueError('Unexpected archive entry')
                data = file.read_bytes()
                info = tarfile.TarInfo(file.name)
                info.size, info.mode, info.mtime = len(data), 0o644, 0
                out.addfile(info, io.BytesIO(data))
                members.append({'name': file.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    records[source.name] = {'upstreamSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'tarSha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'membersUnchanged': members}
    print(source.name, target.stat().st_size, 'bytes')
(ROOT / 'sources/core-repacking.json').write_text(json.dumps(records, indent=2) + '\n', encoding='utf8')
