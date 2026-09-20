// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { createMeta, generateMetaBlock, toUserscriptConfig } from '@/meta';

type ParsedMeta = Record<string, string[]>;

function parseMetaBlock(script: string): ParsedMeta {
  const match = script.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
  expect(match).not.toBeNull();

  const result: ParsedMeta = {};
  for (const line of match![0].split('\n')) {
    const item = line.match(/^\/\/ @(\S+)\s+(.+)$/);
    if (!item) continue;
    const [, key, value] = item;
    result[key] ||= [];
    result[key].push(value.trim());
  }
  return result;
}

describe('userscript meta', () => {
  it('generates a standard meta block from the shared metadata model', () => {
    const meta = {
      ...createMeta({ version: '1.2.3' }),
      requires: ['https://example.com/dep.js'],
      resources: { demo: 'https://example.com/demo.css' },
    };

    const block = generateMetaBlock(meta);

    expect(block).toContain('// ==UserScript==');
    expect(block).toContain('// @name          YingChuang');
    expect(block).toContain('// @name:zh-CN    萤窗');
    expect(block).toContain('// @description:zh-TW');
    expect(block).toContain('// @version       1.2.3');
    expect(block).toContain('// @description:zh-CN 萤窗：小说阅读脚本');
    expect(block).toContain('// @run-at        document-start');
    expect(block).toContain('// @match         *://*/*.html');
    expect(block).toContain('// @match         *://*/gb_*/*/*');
    expect(block).toContain('// @match         *://dingdianzww.org/*');
    expect(block).toContain('// @match         *://www.deqixs.org/*');
    expect(block).toContain('// @match         *://www.deqixs.co/*');
    expect(block).toContain('// @match         *://m.kudushu.org/html/*/*');
    expect(block).toContain('// @require       https://example.com/dep.js');
    expect(block).toContain('// @resource      demo https://example.com/demo.css');
    expect(block).not.toContain('@id');
    expect(block).not.toContain('@contributor');
    expect(block).not.toContain('@build-date');
    expect(block.trimEnd().endsWith('// ==/UserScript==')).toBe(true);
  });

  it('converts to userscript config shape for build tools', () => {
    const meta = createMeta({ version: '9.9.9' });
    const config = toUserscriptConfig(meta);

    expect(config).toMatchObject({
      name: meta.name,
      version: meta.version,
      match: meta.matches,
      exclude: meta.excludes,
      grant: meta.grants,
      connect: meta.connects,
      'run-at': 'document-start',
    });
    expect(config).not.toHaveProperty('id');
    expect(config).not.toHaveProperty('contributor');
    expect(config).not.toHaveProperty('build-date');
  });

  it('keeps the generated userscript artifact header aligned with source metadata', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
    ) as {
      version: string;
    };
    const sourceMeta = createMeta({ version: packageJson.version });
    const artifact = readFileSync(resolve(process.cwd(), 'scripts', 'YingChuang.user.js'), 'utf8');
    const header = parseMetaBlock(artifact);

    expect(header.name).toEqual([sourceMeta.name['']]);
    expect(header['name:zh-CN']).toEqual([sourceMeta.name['zh-CN']]);
    expect(header['name:zh-TW']).toEqual([sourceMeta.name['zh-TW']]);
    expect(header.version).toEqual([sourceMeta.version]);
    expect(header.namespace).toEqual([sourceMeta.namespace]);
    expect(header.author).toEqual([sourceMeta.author]);
    expect(header.description).toEqual([sourceMeta.description['']]);
    expect(header['description:zh-CN']).toEqual([sourceMeta.description['zh-CN']]);
    expect(header['description:zh-TW']).toEqual([sourceMeta.description['zh-TW']]);
    expect(header.license).toEqual([sourceMeta.license]);
    expect(header.homepage).toEqual([sourceMeta.homepage]);
    expect(header.downloadURL).toEqual([sourceMeta.downloadURL]);
    expect(header.updateURL).toEqual([sourceMeta.updateURL]);
    expect(header.source).toEqual([sourceMeta.source]);
    expect(header.supportURL).toEqual([sourceMeta.supportURL]);
    expect(header['run-at']).toEqual(['document-start']);
    expect(header.match).toEqual(sourceMeta.matches);
    expect(header.exclude).toEqual(sourceMeta.excludes);
    expect(header.connect).toEqual(sourceMeta.connects);
    expect(header.grant).toEqual(expect.arrayContaining(sourceMeta.grants));
    expect(header.id).toBeUndefined();
    expect(header.contributor).toBeUndefined();
    expect(header['build-date']).toBeUndefined();
  });
});
