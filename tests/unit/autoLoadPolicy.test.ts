import { describe, expect, it } from 'vitest';

import {
  type AutoLoadPolicyInput,
  decideAutoLoadNext,
  INTERSECTION_ROOT_MARGIN_PX,
  isViewportNearBottom,
} from '@/ui/composables/reader/autoLoadPolicy';

function makeInput(overrides: Partial<AutoLoadPolicyInput> = {}): AutoLoadPolicyInput {
  return {
    autoLoadInFlight: false,
    currentChapterMerging: false,
    enabled: true,
    failureCooldownUntil: 0,
    graceUntil: 0,
    hasChapter: true,
    hasNext: true,
    isLoadingNext: false,
    isLoadingPrev: false,
    isNavigating: false,
    isNearBottom: true,
    now: 10_000,
    pageHidden: false,
    unreadBufferState: 'empty',
    ...overrides,
  };
}

describe('autoLoadPolicy', () => {
  it('waits for the current chapter to finish merging before fetching ahead', () => {
    expect(decideAutoLoadNext('state', makeInput({ currentChapterMerging: true }))).toEqual({
      type: 'idle',
      clearTimer: false,
    });
    expect(decideAutoLoadNext('state', makeInput({ currentChapterMerging: false }))).toEqual({
      type: 'start',
    });
  });

  it('uses the configured 1600px near-bottom fallback', () => {
    expect(INTERSECTION_ROOT_MARGIN_PX).toBe(1600);
    expect(isViewportNearBottom(5000, 2900, 600)).toBe(true);
    expect(isViewportNearBottom(6000, 1000, 600)).toBe(false);
  });

  it('waits for the hard reading grace period before starting', () => {
    expect(decideAutoLoadNext('state', makeInput({ now: 1000, graceUntil: 3000 }))).toEqual({
      type: 'schedule',
      dueAt: 3000,
    });
  });

  it('starts after the grace period when the base state is eligible', () => {
    expect(decideAutoLoadNext('state', makeInput())).toEqual({ type: 'start' });
  });

  it('keeps viewport-driven triggers behind the distance gate', () => {
    expect(decideAutoLoadNext('settled', makeInput({ isNearBottom: false }))).toEqual({
      type: 'idle',
      clearTimer: false,
    });
    expect(decideAutoLoadNext('visibility', makeInput({ isNearBottom: false }))).toEqual({
      type: 'start',
    });
  });

  it('retries a failed auto preload only after a later trigger reaches cooldown', () => {
    expect(
      decideAutoLoadNext('state', makeInput({ now: 1000, failureCooldownUntil: 6000 }))
    ).toEqual({
      type: 'idle',
      clearTimer: false,
    });
    expect(
      decideAutoLoadNext('sentinel', makeInput({ now: 1000, failureCooldownUntil: 6000 }))
    ).toEqual({
      type: 'schedule',
      dueAt: 6000,
    });
  });

  it('continues through short chapters but stops for a full-screen buffer or the hard cap', () => {
    expect(decideAutoLoadNext('state', makeInput({ unreadBufferState: 'short' }))).toEqual({
      type: 'start',
    });
    expect(decideAutoLoadNext('state', makeInput({ unreadBufferState: 'sufficient' }))).toEqual({
      type: 'idle',
      clearTimer: true,
    });
    expect(decideAutoLoadNext('state', makeInput({ unreadBufferState: 'capped' }))).toEqual({
      type: 'idle',
      clearTimer: true,
    });
  });

  it('clears pending timers when preload is disabled', () => {
    expect(decideAutoLoadNext('state', makeInput({ enabled: false }))).toEqual({
      type: 'idle',
      clearTimer: true,
    });
  });

  it('waits for unread chapter layout without clearing the active timer', () => {
    expect(decideAutoLoadNext('state', makeInput({ unreadBufferState: 'pending' }))).toEqual({
      type: 'idle',
      clearTimer: false,
    });
  });

  it('idles without clearing timers for temporary busy states', () => {
    expect(decideAutoLoadNext('state', makeInput({ isLoadingNext: true }))).toEqual({
      type: 'idle',
      clearTimer: false,
    });
  });
});
