"""SPDX-License-Identifier: AGPL-3.0-or-later
Inspect reachable Git history and non-ignored publication candidates.
No credential values are printed. A heuristic scan is not a rights clearance.
"""
from pathlib import Path
import importlib.util, subprocess, sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('content_audit', Path(__file__).with_name('audit-content.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def run():
    revisions = git('rev-list', '--all').decode().splitlines()
    objects = set()
    for revision in revisions:
        for entry in git('ls-tree', '-rz', '--full-tree', revision).split(b'\0'):
            if not entry:
                continue
            meta, name = entry.split(b'\t', 1)
            mode, kind, oid = meta.decode().split()
            name = name.decode('utf8')
            if kind != 'blob' or mode == '120000':
                raise ValueError('Unreviewed symlink/submodule in Git: ' + name)
            objects.add((oid, name))
    process = subprocess.Popen(['git', 'cat-file', '--batch'], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    try:
        for oid, name in sorted(objects):
            audit.check_name(name)
            process.stdin.write((oid + '\n').encode())
            process.stdin.flush()
            header = process.stdout.readline().split()
            if len(header) != 3 or header[1] != b'blob':
                raise ValueError('Unable to inspect Git object: ' + name)
            size = int(header[2])
            if size >= audit.MAX_FILE:
                raise ValueError('Oversized Git object: ' + name)
            data = process.stdout.read(size)
            if len(data) != size or process.stdout.read(1) != b'\n':
                raise ValueError('Truncated Git object: ' + name)
            audit.Scanner().inspect(name, data)
    finally:
        process.stdin.close()
        process.stdout.close()
        process.wait(timeout=10)
    candidates = set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').decode('utf8').split('\0')) - {''}
    count = 0
    for name in sorted(candidates):
        file = ROOT / name
        if file.is_symlink() or not file.resolve().is_relative_to(ROOT):
            raise ValueError('Unsafe publication candidate: ' + name)
        if file.is_file():
            audit.Scanner().inspect(name, file.read_bytes())
            count += 1
    print(f'PASS: {len(revisions)} reachable commits, {len(objects)} unique path/blob pairs and {count} working-tree candidates inspected, including nested archives.')


if __name__ == '__main__':
    run()
