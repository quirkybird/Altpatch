#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const mode = process.argv[2] || 'check';
const roots = ['packages', 'apps'];
const skipDirs = new Set(['node_modules', '.git', '.turbo', 'dist', 'build', 'coverage', '.pnpm-store']);
const exts = ['.js', '.js.map', '.d.ts', '.d.ts.map'];
const tsSourceExts = ['.ts', '.tsx', '.mts', '.cts'];

function exists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function artifactBaseName(fileName) {
  if (fileName.endsWith('.js.map')) return fileName.slice(0, -'.js.map'.length);
  if (fileName.endsWith('.d.ts.map')) return fileName.slice(0, -'.d.ts.map'.length);
  if (fileName.endsWith('.d.ts')) return fileName.slice(0, -'.d.ts'.length);
  if (fileName.endsWith('.js')) return fileName.slice(0, -'.js'.length);
  return null;
}

function isPotentialArtifact(filePath) {
  const fileName = path.basename(filePath);
  if (!exts.some((ext) => fileName.endsWith(ext))) return false;

  const base = artifactBaseName(fileName);
  if (!base) return false;
  const dir = path.dirname(filePath);
  return tsSourceExts.some((ext) => exists(path.join(dir, `${base}${ext}`)));
}

function walk(dir, out) {
  if (!exists(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (isPotentialArtifact(full)) {
      out.push(full);
    }
  }
}

function collectArtifacts() {
  const out = [];
  for (const root of roots) walk(root, out);
  return out;
}

const artifacts = collectArtifacts();

if (mode === 'clean') {
  for (const filePath of artifacts) {
    fs.rmSync(filePath, { force: true });
    console.log(`removed: ${filePath}`);
  }
  console.log(`cleaned ${artifacts.length} artifact file(s).`);
  process.exit(0);
}

if (mode === 'check') {
  if (artifacts.length === 0) {
    console.log('no side-by-side build artifacts found.');
    process.exit(0);
  }
  console.error('found side-by-side build artifacts:');
  for (const filePath of artifacts) {
    console.error(`- ${filePath}`);
  }
  process.exit(1);
}

console.error(`unknown mode: ${mode}`);
console.error('usage: node scripts/src-artifacts.cjs [check|clean]');
process.exit(2);
