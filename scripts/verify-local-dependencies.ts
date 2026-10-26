import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Manifest {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
interface LockEntry extends Manifest {
  resolved?: string;
  integrity?: string;
  optional?: boolean;
}
interface Lock {
  lockfileVersion?: number;
  packages?: Record<string, LockEntry>;
}
interface PackageSnapshot {
  name: string;
  version: string;
  manifestSha256: string;
}
interface DependencySnapshot {
  formatVersion: 1;
  generatedAt: string;
  packageName: string;
  packageVersion: string;
  lockfile: { format: number; sha256: string; packageEntries: number };
  declaredPackages: PackageSnapshot[];
  integrityScope: string;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modulesRoot = join(root, 'node_modules');
const snapshotFile = join(root, 'docs', 'DEPENDENCY_SNAPSHOT.json');
const issues: string[] = [];
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const readJson = <T,>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
const stableEntries = (value: Record<string, string> | undefined) => Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b));

function main(): void {
  const writeSnapshot = process.argv.includes('--write-snapshot');
  const rootManifest = readJson<Manifest>(join(root, 'package.json'));
  const lockBytes = readFileSync(join(root, 'package-lock.json'));
  const lock = JSON.parse(lockBytes.toString('utf8')) as Lock;
  const declarations = { ...rootManifest.dependencies, ...rootManifest.devDependencies };
  const selected: PackageSnapshot[] = [];
  if (lock.lockfileVersion !== 3 || !lock.packages?.['']) issues.push('Expected package-lock v3 with a root entry');
  for (const section of ['dependencies', 'devDependencies'] as const) {
    if (JSON.stringify(stableEntries(rootManifest[section])) !== JSON.stringify(stableEntries(lock.packages?.['']?.[section]))) {
      issues.push(`Lock root ${section} differs from package.json`);
    }
  }

  for (const [name, version] of Object.entries(declarations).sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name)) {
      issues.push(`Invalid declared package name: ${name}`);
      continue;
    }
    const file = join(modulesRoot, name, 'package.json');
    if (!existsSync(file)) {
      issues.push(`Missing declared package: ${name}`);
      continue;
    }
    const bytes = readFileSync(file);
    const installed = JSON.parse(bytes.toString('utf8')) as Manifest;
    const entry = lock.packages?.[`node_modules/${name}`];
    if (installed.name !== name || installed.version !== version) issues.push(`Declared version mismatch: ${name} ${version} / ${installed.version}`);
    if (entry?.version !== version) issues.push(`Declared package differs from lock: ${name}`);
    selected.push({ name, version, manifestSha256: sha256(bytes) });
  }

  let checkedInstalled = 0;
  let absentOptional = 0;
  const packageEntries = Object.entries(lock.packages ?? {}).filter(([key]) => key !== '');
  for (const [key, entry] of packageEntries) {
    const packagePath = resolve(root, key);
    if (!packagePath.startsWith(modulesRoot + sep)) {
      issues.push(`Lock package path outside node_modules: ${key}`);
      continue;
    }
    if (!entry.resolved || !entry.integrity) issues.push(`Missing registry resolution metadata: ${key}`);
    const file = join(packagePath, 'package.json');
    if (!existsSync(file)) {
      if (entry.optional) absentOptional++;
      else issues.push(`Missing installed lock entry: ${key}`);
      continue;
    }
    const actual = readJson<Manifest>(file);
    if (actual.version !== entry.version) issues.push(`Lock version mismatch: ${key}`);
    checkedInstalled++;
  }

  const current: DependencySnapshot = {
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    packageName: rootManifest.name ?? '',
    packageVersion: rootManifest.version ?? '',
    lockfile: { format: lock.lockfileVersion ?? 0, sha256: sha256(lockBytes), packageEntries: packageEntries.length },
    declaredPackages: selected,
    integrityScope: 'SHA-256 covers this lockfile and selected installed package.json files. npm uses registry integrity during install; this verifier does not manually hash compressed package tarballs or every installed file.',
  };
  if (issues.length === 0 && writeSnapshot) writeFileSync(snapshotFile, JSON.stringify(current, null, 2) + '\n');
  if (!existsSync(snapshotFile)) issues.push('Missing dependency snapshot; regenerate explicitly after a reviewed install');
  else {
    const recorded = readJson<DependencySnapshot>(snapshotFile);
    if (recorded.formatVersion !== 1) issues.push('Unsupported dependency snapshot format');
    if (recorded.packageName !== current.packageName || recorded.packageVersion !== current.packageVersion) issues.push('Snapshot root package identity mismatch');
    if (JSON.stringify(recorded.lockfile) !== JSON.stringify(current.lockfile)) issues.push('Lockfile hash/count differs from reviewed snapshot');
    if (JSON.stringify(recorded.declaredPackages) !== JSON.stringify(current.declaredPackages)) issues.push('Declared versions or installed manifest hashes differ from reviewed snapshot');
  }
  if (issues.length) {
    console.error(JSON.stringify({ ok: false, issues }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      ok: true,
      snapshotWritten: writeSnapshot,
      declaredPackages: selected.length,
      selectedManifestHashes: selected.length,
      lockPackageEntries: packageEntries.length,
      checkedInstalledLockEntries: checkedInstalled,
      absentOptionalLockEntries: absentOptional,
      limitation: current.integrityScope,
    }, null, 2));
  }
}

try { main(); }
catch (error) {
  console.error(JSON.stringify({ ok: false, issues: [error instanceof Error ? error.message : String(error)] }, null, 2));
  process.exitCode = 1;
}
