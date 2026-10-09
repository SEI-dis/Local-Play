"""SPDX-License-Identifier: AGPL-3.0-or-later
Regression tests for the previously missed archive contents and stale source.
"""
from pathlib import Path
import importlib.util, io, tarfile, tempfile, unittest, zipfile, sys
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('audit', Path(__file__).resolve().parents[1] / 'scripts/audit-content.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

def tar(name, content):
    out = io.BytesIO()
    with tarfile.open(fileobj=out, mode='w:gz') as t:
        info = tarfile.TarInfo(name); info.size = len(content)
        t.addfile(info, io.BytesIO(content))
    return out.getvalue()

def zip(name, content):
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w') as z: z.writestr(name, content)
    return out.getvalue()

class AuditTests(unittest.TestCase):
    def test_rom_signature_with_an_innocent_extension(self):
        for offset, signature in [(0x104, 'ceed6666cc0d'), (4, '24ffae51699aa221'), (0xc0, '24ffae51699aa221')]:
            data = bytearray(1024); data[offset:offset+len(bytes.fromhex(signature))] = bytes.fromhex(signature)
            with self.assertRaisesRegex(ValueError, 'ROM signature'):
                audit.Scanner().inspect('image.png', bytes(data))

    def test_secret_and_private_data_in_archives(self):
        for name, data in [('settings/.env', b'private'), ('file.txt', b'gh' + b'p_' + b'x'*40), ('firmware.bios', b'private'), ('skin.deltaskin', b'private')]:
            with self.assertRaises(ValueError):
                audit.Scanner().inspect('source.zip', zip(name, data))

    def test_rom_hidden_in_tar_gzip_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'ROM/save'):
            audit.Scanner().inspect('source.tar.gz', tar('tests/fixture.gba', b'original test data'))

    def test_save_in_nested_zip_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'ROM/save'):
            audit.Scanner().inspect('outer.zip', zip('inner.zip', zip('save.sav', b'save data')))

    def test_every_tar_member_is_pinned(self):
        s = audit.Scanner(); s.inspect('source.tar.gz', tar('src/core.c', b'int main(){}'))
        self.assertEqual([x['path'] for x in s.rows], ['source.tar.gz', 'source.tar.gz!src/core.c'])

    def test_disguised_archive_and_unsafe_path(self):
        with self.assertRaisesRegex(ValueError, 'ROM/save'):
            audit.Scanner().inspect('opaque.dat', zip('private.srm', b'test'))
        with self.assertRaisesRegex(ValueError, 'Unsafe archive'):
            audit.Scanner().inspect('source.tar.gz', tar('../outside.c', b'x'))

    def test_unregistered_file_and_changed_file(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); (root/'app.js').write_text('original', encoding='utf8')
            audit.run(root, record=True)
            (root/'unknown.js').write_text('unreviewed', encoding='utf8')
            with self.assertRaisesRegex(ValueError, 'unregistered'): audit.run(root)
            (root/'unknown.js').unlink(); (root/'app.js').write_text('changed', encoding='utf8')
            with self.assertRaisesRegex(ValueError, 'changed'): audit.run(root)

if __name__ == '__main__': unittest.main()
