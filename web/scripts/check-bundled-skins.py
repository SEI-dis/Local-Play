"""SPDX-License-Identifier: AGPL-3.0-or-later
Verify the reviewed CC-BY artwork allowlist, including packaged sources.
Adding files or changing provenance requires a new explicit rights review.
"""
from pathlib import Path
import hashlib, json, re, zipfile

def verify(root):
    manifest = json.loads((root/'BUNDLED_SKINS.json').read_text(encoding='utf-8'))
    assert manifest['license'] == 'CC-BY-4.0'
    assert manifest['repository'] == 'https://github.com/Manic-EMU/ManicEMUSkins'
    assert re.fullmatch('[0-9a-f]{40}', manifest['commit'])
    assert manifest['attribution'] and manifest['changes']
    skins = manifest['skins']
    assert len(skins) == 7 and {s['system'] for s in skins} == {'gb','gbc','gba','nes','snes','md','nds'}
    files = manifest['files']
    actual = {manifest['licenseFile']}
    for folder in ['assets/skins', 'sources/manic-skins']:
        for p in (root/folder).rglob('*'):
            assert not p.is_symlink(), 'Symlink in skin bundle'
            if p.is_file(): actual.add(p.relative_to(root).as_posix())
    assert actual == set(files), 'Unreviewed or missing bundled skin file'
    for rel, expected in files.items():
        file = (root/rel).resolve()
        assert file.is_relative_to(root.resolve()), 'Unsafe skin path'
        assert hashlib.sha256(file.read_bytes()).hexdigest() == expected, 'Changed reviewed skin file: '+rel
    assert 'Creative Commons Attribution 4.0 International' in (root/manifest['licenseFile']).read_text()
    for skin in skins:
        system = skin['system']
        name = 'DS' if system == 'nds' else system.upper()
        assert skin['id'] == 'bundled:manic-'+system
        assert skin['upstreamFile'] == name+'.manicskin'
        assert skin['sourceArchive'] == f'sources/manic-skins/{name}.zip'
        assert skin['dataFile'] == f'assets/skins/manic/{system}/skin.json'
        assert re.fullmatch('[0-9a-f]{64}', skin['upstreamSha256'])
        record = json.loads((root/skin['dataFile']).read_text())
        assert record['id'] == skin['id'] and record['system'] == system
        assert record['name'] == skin['name'] and not record['warnings']
        images = record['images']
        with zipfile.ZipFile(root/skin['sourceArchive']) as source:
            assert set(source.namelist()) == {'info.json', 'LICENSE', 'ATTRIBUTION.txt', 'UPSTREAM-README.md', *images}, 'Unexpected source archive member'
            assert source.read('LICENSE') == (root/manifest['licenseFile']).read_bytes()
            assert manifest['attribution'].encode() in source.read('ATTRIBUTION.txt')
            info = json.loads(source.read('info.json'))
            assert info['name'] == skin['name']
            for name in images:
                assert re.fullmatch(r'[a-z0-9_-]+\.pdf', name)
                assert source.read(name).startswith(b'%PDF-')
                assert images[name] == name+'.png'
        expected_assets = {'skin.json', *images.values()}
        folder = (root/skin['dataFile']).parent
        assert {p.name for p in folder.iterdir()} == expected_assets
        for name in images.values():
            data = (folder/name).read_bytes()
            assert data.startswith(b'\x89PNG\r\n\x1a\n')
            w, h = int.from_bytes(data[16:20], 'big'), int.from_bytes(data[20:24], 'big')
            assert 0 < w <= 2048 and 0 < h <= 2048
        for rep in record['variants']:
            assert rep['assets']['resizable'] in images
            for item in rep['items']:
                for name in item.get('asset', {}).values(): assert name in images
    print('PASS: seven CC-BY skins, exact file allowlist, source members, image hashes and retained license.')

if __name__ == '__main__':
    verify(Path(__file__).resolve().parent.parent)
