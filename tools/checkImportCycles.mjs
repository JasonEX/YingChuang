/**
 * Fail the build on circular imports inside src/.
 *
 * eslint-plugin-import would give the same guarantee, but it is a sizeable dev dependency for
 * one rule, so this walks the graph directly. It understands the '@/' alias, relative paths,
 * and treats a directory import as its index file. `import type` is skipped: a type-only edge
 * is erased at build time and cannot produce a runtime cycle.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');
const EXTENSIONS = ['.ts', '.vue', '.js'];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.includes(path.extname(full)) && !full.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

function resolveSpecifier(specifier, fromFile) {
  let base;
  if (specifier.startsWith('@/')) base = path.join(srcDir, specifier.slice(2));
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(fromFile), specifier);
  else return null; // bare package import

  const candidates = [
    base,
    ...EXTENSIONS.map(ext => base + ext),
    ...EXTENSIONS.map(ext => path.join(base, 'index' + ext)),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // keep looking
    }
  }
  return null;
}

// `import ... from 'x'`, `export ... from 'x'`, and `import('x')`, minus type-only forms.
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s+(?!type\s)([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g;
const DYNAMIC_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

function readEdges(file) {
  const source = readFileSync(file, 'utf8');
  const targets = new Set();
  for (const match of source.matchAll(IMPORT_RE)) {
    // `import { type A, type B }` is also erased; only count value members.
    const clause = match[1];
    const onlyTypes =
      clause.startsWith('{') &&
      clause
        .replace(/[{}]/g, '')
        .split(',')
        .filter(part => part.trim())
        .every(part => part.trim().startsWith('type '));
    if (onlyTypes) continue;
    const resolved = resolveSpecifier(match[2], file);
    if (resolved) targets.add(resolved);
  }
  for (const match of source.matchAll(DYNAMIC_RE)) {
    const resolved = resolveSpecifier(match[1], file);
    if (resolved) targets.add(resolved);
  }
  return targets;
}

const graph = new Map();
for (const file of walk(srcDir)) graph.set(file, readEdges(file));

const cycles = [];
const state = new Map(); // file -> 'visiting' | 'done'
const stack = [];

function visit(file) {
  if (state.get(file) === 'done') return;
  if (state.get(file) === 'visiting') {
    cycles.push([...stack.slice(stack.indexOf(file)), file]);
    return;
  }
  state.set(file, 'visiting');
  stack.push(file);
  for (const next of graph.get(file) ?? []) visit(next);
  stack.pop();
  state.set(file, 'done');
}

for (const file of graph.keys()) visit(file);

const rel = file => path.relative(root, file);

if (cycles.length > 0) {
  console.error(`[cycles] ${cycles.length} circular import chain(s) found:`);
  for (const cycle of cycles) console.error('  ' + cycle.map(rel).join('\n    -> '));
  console.error('[cycles] Break the cycle before committing.');
  process.exitCode = 1;
} else {
  console.log(`[cycles] none found across ${graph.size} modules in src/`);
}
