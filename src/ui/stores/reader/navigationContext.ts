import type { CachedChapter, ChapterEntry } from './types';
import type { ConversionMode } from '@/core/converter';
import type { Ref } from 'vue';

export interface NavigationContext {
  chapters: Ref<ChapterEntry[]>;
  currentChapterIndex: Ref<number>;
  isLoadingNext: Ref<boolean>;
  isLoadingPrev: Ref<boolean>;
  pendingNextAbort: Ref<(() => void) | null>;
  pendingPrevAbort: Ref<(() => void) | null>;
  reloadAbort: Ref<(() => void) | null>;
  loadedUrls: Readonly<Ref<ReadonlySet<string>>>;
  vipBlockedUrls: Ref<Set<string>>;
  blockedNavUrls: Ref<Set<string>>;
  cachedContents: Ref<Map<string, CachedChapter>>;
  persistedUrls: Ref<Set<string>>;
  originalContents: Ref<Map<string, string>>;
  originalTitles: Ref<Map<string, { title: string; bookTitle?: string }>>;
  currentConversionMode: Ref<ConversionMode>;
  navFailures: Map<string, { count: number; nextRetryAt: number }>;
  history: Ref<string[]>;

  runtime: {
    bumpView: () => number;
    isViewStale: (runId: number) => boolean;
    viewId: () => number;
  };

  showToast: (msg: string, type: 'info' | 'error', duration?: number) => void;
  setError: (msg: string) => void;
  applyConversionToChapterEntry: (entryId: string, mode: ConversionMode) => Promise<void>;
  getPersistedCachedChapter: (url: string) => CachedChapter | null;
}
