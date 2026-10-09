"""SPDX-License-Identifier: AGPL-3.0-or-later
Build and check an upstream mGBA candidate WITHOUT modifying the shipped core.
Only public source and generated tests are used. Outputs go to ignored work/.
This is an engineering check, not automatic permission to redistribute.
"""
from pathlib import Path, PurePosixPath
import argparse, gzip, hashlib, importlib.util, io, json, os, re, shutil
import subprocess, sys, tarfile

WEB = Path(__file__).resolve().parents[1]
REPO = WEB.parent
RECIPE = WEB / 'sources/mgba-web-port'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


def run(args, *, env=None, log=None, cwd=None):
    result = subprocess.run([str(a) for a in args], env=env, cwd=cwd,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if log:
        log.write_bytes(result.stdout)
    if result.returncode:
        raise RuntimeError('Command failed; inspect the local phase log.')
    return result.stdout.decode('utf8', errors='replace').strip()


def extract_git_archive(payload, destination):
    destination.mkdir()
    with tarfile.open(fileobj=io.BytesIO(payload)) as archive:
        for member in archive:
            name = PurePosixPath(member.name)
            if name.is_absolute() or '..' in name.parts or '\\' in member.name or ':' in member.name:
                raise ValueError('Unsafe upstream source path')
            if member.isdir():
                continue
            if not member.isfile():
                raise ValueError('Upstream symlink or special file needs review')
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.extractfile(member).read())


def source_closure(source, build, ninja):
    """Retain compiler dependencies, CMake inputs, and every upstream notice."""
    keep = set()
    for line in run([ninja, '-C', build, '-t', 'deps']).splitlines():
        if not line.startswith('    '):
            continue
        path = Path(line.strip())
        path = (path if path.is_absolute() else build / path).resolve()
        if path.is_file() and path.is_relative_to(source):
            keep.add(path)
    for command in json.loads((build / 'compile_commands.json').read_text(encoding='utf8')):
        path = Path(command['file']).resolve()
        if path.is_relative_to(source):
            keep.add(path)
    for path in source.rglob('*'):
        if not path.is_file():
            continue
        if (path.name == 'CMakeLists.txt' or path.suffix in {'.cmake', '.in'} or
                re.match(r'(?i)^(LICEN[SC]E|COPYING|COPYRIGHT|NOTICE|AUTHORS|README)', path.name)):
            keep.add(path)
    if len(keep) < 100:
        raise ValueError('Incomplete compiler dependency inventory')
    return {p.relative_to(source).as_posix(): p.read_bytes() for p in sorted(keep)}


def package_source(files, target):
    stream = io.BytesIO()
    with tarfile.open(fileobj=stream, mode='w', format=tarfile.PAX_FORMAT) as archive:
        for name, data in sorted(files.items()):
            member = tarfile.TarInfo('mgba/' + name)
            member.size, member.mode, member.mtime = len(data), 0o644, 0
            archive.addfile(member, io.BytesIO(data))
    target.write_bytes(gzip.compress(stream.getvalue(), mtime=0))


def source_inventory(files):
    # Capture every retained file, not just LICENSE: headers and dependencies can change.
    return {name: sha(data) for name, data in sorted(files.items())}


def baseline_sources():
    with tarfile.open(WEB / 'sources/mgba-celio-rom64-source.tar.gz') as archive:
        return {m.name.split('/', 1)[1]: archive.extractfile(m).read()
                for m in archive if m.isfile() and '/' in m.name}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--emsdk', type=Path, required=True)
    parser.add_argument('--commit', help='Exact 40-character upstream commit; default: branch head at start')
    args = parser.parse_args()
    if args.commit and not re.fullmatch('[0-9a-f]{40}', args.commit):
        parser.error('--commit must be an exact lowercase 40-character commit SHA')
    config = json.loads((RECIPE / 'upstream.json').read_text(encoding='utf8'))
    current = json.loads((WEB / 'SOURCES.json').read_text(encoding='utf8'))['mgba']['sourceCommit']
    sdk = args.emsdk.resolve()
    if run(['git', '-C', sdk, 'rev-parse', 'HEAD']) != config['emsdkCommit']:
        raise ValueError('Activate the reviewed emsdk revision first')
    version = (sdk / 'upstream/emscripten/emscripten-version.txt').read_text().strip().strip('"')
    if version != config['emscripten']:
        raise ValueError('Activate the reviewed Emscripten version first')
    installed = (sdk / 'upstream/.emsdk_version').read_text().strip()
    if config['emscriptenReleasesCommit'] not in installed:
        raise ValueError('Installed compiler build differs from the reviewed release')
    cmake, ninja = shutil.which('cmake'), shutil.which('ninja')
    if not cmake or not ninja:
        raise ValueError('CMake and Ninja must be on PATH')
    # Resolve the moving branch once, then use this immutable commit everywhere.
    commit = args.commit or run(['git', 'ls-remote', config['repository'],
                                'refs/heads/' + config['branch']]).split()[0]
    if not re.fullmatch('[0-9a-f]{40}', commit):
        raise ValueError('Could not resolve an exact upstream revision')
    parent = (REPO / 'work/core-candidates').resolve()
    if not parent.is_relative_to(REPO.resolve()):
        raise ValueError('Output escaped the ignored workspace directory')
    parent.mkdir(parents=True, exist_ok=True)
    # Never remove or overwrite prior candidates. Also permits a repeatability check.
    from tempfile import mkdtemp
    output = Path(mkdtemp(prefix=commit[:12] + '-', dir=parent))
    report = {'schema': 1, 'status': 'checking', 'published': False,
              'repository': config['repository'], 'branch': config['branch'],
              'baselineCommit': current, 'candidateCommit': commit,
              'compareUrl': config['repository'].removesuffix('.git') + '/compare/' + current + '...' + commit,
              'reviewedMaxRomBytes': config['reviewedMaxRomBytes'],
              'checks': {}, 'requiresReview': [
                  'License/header and dependency changes, with existing notices retained',
                  'State/save compatibility and required ROM capacity',
                  'Browser, offline, performance and link regression tests',
                  'Exact corresponding source and renewed release review before deployment']}
    phase = 'source'
    print('Candidate:', commit, flush=True)
    print('Local output:', output, flush=True)
    try:
        repo, source = output / 'upstream', output / 'source'
        run(['git', 'init', '-q', repo])
        run(['git', '-C', repo, '-c', 'credential.helper=', 'fetch', '--depth=1',
             config['repository'], commit], log=output / 'fetch.log')
        payload = subprocess.check_output(['git', '-C', str(repo), 'archive', 'FETCH_HEAD'])
        extract_git_archive(payload, source)
        phase = 'build'
        env = dict(os.environ)
        env['EM_CONFIG'] = str(sdk / '.emscripten')
        toolchain = sdk / 'upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake'

        def build_core(src, name):
            build = output / name
            run([cmake, '-S', RECIPE, '-B', build, '-G', 'Ninja',
                 '-DCMAKE_BUILD_TYPE=Release', '-DCMAKE_EXPORT_COMPILE_COMMANDS=ON',
                 '-DCMAKE_TOOLCHAIN_FILE=' + str(toolchain), '-DCMAKE_MAKE_PROGRAM=' + ninja,
                 '-DMGBA_SOURCE=' + str(src)], env=env, log=output / (name + '-configure.log'))
            run([cmake, '--build', build, '--parallel', '4'], env=env, log=output / (name + '.log'))
            return build

        build = build_core(source, 'build')
        report['checks']['build'] = True
        phase = 'corresponding-source'
        files = source_closure(source, build, ninja)
        previous_files = baseline_sources()
        prior = source_inventory(previous_files)
        inventory = source_inventory(files)
        different = sorted(n for n in inventory.keys() & prior.keys() if inventory[n] != prior[n])
        # Earlier Windows builds retained CRLF checkouts. Report that separately;
        # archive/source hashes always identify the exact, unnormalized bytes.
        line_endings = [n for n in different if b'\0' not in files[n] and
                        files[n].replace(b'\r\n', b'\n') == previous_files[n].replace(b'\r\n', b'\n')]
        report['sourceChanges'] = {'added': sorted(inventory.keys() - prior.keys()),
                                   'removed': sorted(prior.keys() - inventory.keys()),
                                   'changed': [n for n in different if n not in line_endings],
                                   'lineEndingsOnly': line_endings}
        package = output / 'candidate'
        package.mkdir()
        archive = package / 'mgba-celio-rom64-source.tar.gz'
        package_source(files, archive)
        # Apply the same no-ROM/BIOS/secret/archive rules used for publication.
        spec = importlib.util.spec_from_file_location('content_audit', WEB / 'scripts/audit-content.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.Scanner().inspect(archive.name, archive.read_bytes())
        subset = output / 'rebuild-source'
        for name, data in files.items():
            path = subset / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        rebuild = build_core(subset, 'rebuild')
        report['sourceSha256'] = sha(archive.read_bytes())
        report['binaries'] = {}
        for extension in ['js', 'wasm']:
            name = 'mgba.' + extension
            data = (build / name).read_bytes()
            if data != (rebuild / name).read_bytes():
                raise ValueError('Rebuild from packaged source does not match')
            report['binaries'][name] = sha(data)
            (package / name).write_bytes(data)
        shutil.copytree(RECIPE, package / 'mgba-web-port')
        write_json(package / 'source-inventory.json', inventory)
        report['toolchain'] = {'emsdkCommit': config['emsdkCommit'], 'emscripten': version,
                               'emscriptenReleasesCommit': config['emscriptenReleasesCommit'],
                               'cmake': run([cmake, '--version']).splitlines()[0],
                               'ninja': run([ninja, '--version'])}
        report['checks']['corresponding-source'] = True
        phase = 'synthetic-core'
        test_env = dict(env, MGBA_CORE_PATH=str(package / 'mgba.js'))
        run(['node', WEB / 'tests/core.cjs'], env=test_env, log=output / 'core-test.log')
        report['checks']['synthetic-core'] = True
        phase = 'upgrade-compatibility'
        run(['node', WEB / 'tests/core-upgrade.cjs', WEB / 'cores/mgba/mgba.js',
             package / 'mgba.js'], env=test_env, log=output / 'upgrade-test.log')
        report['checks']['upgrade-compatibility'] = True
        report['status'] = 'needs-review'
        print('Automated checks passed. Candidate still requires review; shipped files unchanged.')
    except Exception:
        # No local paths, environment, source excerpts or personal data in the uploadable report.
        report['checks'][phase] = False
        report['status'] = 'blocked'
        report['blockedPhase'] = phase
        print('Candidate blocked during ' + phase + '. Inspect the local logs; shipped files unchanged.')
        raise
    finally:
        upgrade_log = output / 'upgrade-test.log'
        if upgrade_log.exists():
            # Only fixed test labels; do not upload arbitrary compiler output or local paths.
            labels = {'old-state', 'old-battery', 'extended-flash', 'extended-ram-state'}
            outcomes = []
            for line in upgrade_log.read_text(encoding='utf8', errors='replace').splitlines():
                match = re.fullmatch(r'(CHECK|PASS|SKIP): ([a-z-]+)', line)
                if match and match[2] in labels:
                    outcomes.append({'check': match[2], 'result': match[1].lower()})
            report['upgradeChecks'] = outcomes
        write_json(output / 'report.json', report)
        # A fixed report location is convenient for CI; binary/source candidates are NOT uploaded.
        write_json(parent / 'latest-report.json', report)


if __name__ == '__main__':
    main()
