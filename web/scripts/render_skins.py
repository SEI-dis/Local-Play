"""Recreate Web skin assets from the original source archives.

SPDX-License-Identifier: AGPL-3.0-or-later
Install PyMuPDF (the conversion tool is not shipped in the Web runtime).
Usage: python scripts/render_skins.py
"""
from pathlib import Path
import json, zipfile
import fitz

root = Path(__file__).resolve().parent.parent
for system in ['GBA', 'GB', 'GBC', 'NES', 'SNES', 'MD']:
    target = root / 'assets/skins' / system.lower()
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(root / 'sources/skins' / (system + '.manicskin')) as archive:
        info = json.loads(archive.read('info.json').decode('utf-8-sig'))
        reps = info['representations']['iphone']
        reps = reps.get('edgeToEdge', reps.get('standard'))
        names = set()
        for rep in reps.values():
            names.update(rep['assets'].values())
            for item in rep['items']:
                names.update(item.get('asset', {}).values())
        for name in sorted(names):
            with fitz.open(stream=archive.read(name), filetype='pdf') as pdf:
                pdf[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=True).save(target / (Path(name).stem + '.png'))
        (target / 'skin.json').write_text(json.dumps(reps).replace('.pdf', '.png'), encoding='utf-8')
    print(system, 'rendered', len(names), 'assets')
