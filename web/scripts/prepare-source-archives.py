"""SPDX-License-Identifier: AGPL-3.0-or-later
Remove non-build fixtures from pinned upstream downloads, retaining notices.
Usage: python prepare-source-archives.py ORIGINAL_ARCHIVE_DIRECTORY
Never run against the only copy of the original upstream downloads.
"""
from pathlib import Path
import gzip, hashlib, io, json, sys, tarfile

ROOT = Path(__file__).resolve().parent.parent
RULES = {
    'mgba-celio-rom64-source.tar.gz': lambda p: not p.startswith('cinema/'),
    'mgba-celio-web-source.tar.gz': lambda p: p in ('LICENSE', 'README.md') or p.startswith('web/') and Path(p).suffix in ('.c', '.h', '.txt', '.sh', '.md', '.json'),
    'retroarch-source.tar.gz': lambda p: p not in ('pkg/apple/assets.zip', 'pkg/apple/OSX/assets.zip', 'pkg/ctr/assets/assets.7z'),
}

def main(originals):
    evidence = {}
    for name, keep in RULES.items():
        source = originals / name
        target = ROOT / 'sources' / name
        if source.resolve() == target.resolve():
            raise ValueError('Keep the upstream original outside the release tree')
        data = source.read_bytes()
        removed, retained = [], []
        buf = io.BytesIO()
        with tarfile.open(fileobj=io.BytesIO(data)) as src, tarfile.open(fileobj=buf, mode='w', format=tarfile.PAX_FORMAT) as dst:
            for member in src:
                if not member.isfile():
                    continue
                relative = member.name.split('/', 1)[-1]
                payload = src.extractfile(member).read()
                record = {'path': member.name, 'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}
                if keep(relative):
                    dst.addfile(member, io.BytesIO(payload))
                    retained.append(record)
                else:
                    removed.append(record)
        target.write_bytes(gzip.compress(buf.getvalue(), mtime=0))
        evidence[name] = {'originalSha256': hashlib.sha256(data).hexdigest(), 'filteredSha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'retainedFiles': len(retained), 'removed': removed}
        print(name, 'retained', len(retained), 'removed', len(removed))
    (ROOT / 'sources' / 'archive-filtering.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf8')

if __name__ == '__main__':
    main(Path(sys.argv[1]))
