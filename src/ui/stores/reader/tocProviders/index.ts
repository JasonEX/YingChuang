import type { SiteRequestDiagnostic } from '@/core/utils/siteRequest';
import type { SiteRule } from '@/core/rules/types';
import type { TocEntry } from '../types';

export interface SpecialTocLoaderContext {
  onRequest?: (result: SiteRequestDiagnostic) => void;
  currentUrl: string;
  indexUrl: string;
  rule?: SiteRule;
  setAbort: (abort: (() => void) | null) => void;
}

export interface SpecialTocLoader {
  id: string;
  matches: (context: SpecialTocLoaderContext) => boolean;
  load: (context: SpecialTocLoaderContext) => Promise<TocEntry[]>;
}

export interface SpecialTocTitleCleaner {
  id: string;
  clean: (title: string, url: string) => string;
}

type TocSpecialModule = Record<string, unknown>;

// Optional TOC special cases are picked up automatically from sibling files.
const modules = import.meta.glob<TocSpecialModule>(['./*.ts', '!./index.ts'], { eager: true });

function isSpecialTocLoader(value: unknown): value is SpecialTocLoader {
  if (!value || typeof value !== 'object') return false;

  const maybe = value as Partial<SpecialTocLoader>;
  return (
    typeof maybe.id === 'string' &&
    typeof maybe.matches === 'function' &&
    typeof maybe.load === 'function'
  );
}

function isSpecialTocTitleCleaner(value: unknown): value is SpecialTocTitleCleaner {
  if (!value || typeof value !== 'object') return false;

  const maybe = value as Partial<SpecialTocTitleCleaner>;
  return typeof maybe.id === 'string' && typeof maybe.clean === 'function';
}

export const specialTocLoaders: SpecialTocLoader[] = Object.keys(modules)
  .sort()
  .flatMap(path => Object.values(modules[path]).filter(isSpecialTocLoader));

export const specialTocTitleCleaners: SpecialTocTitleCleaner[] = Object.keys(modules)
  .sort()
  .flatMap(path => Object.values(modules[path]).filter(isSpecialTocTitleCleaner));
