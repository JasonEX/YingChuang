export const INTERSECTION_ROOT_MARGIN_PX = 1600;
export const MAX_UNREAD_PRELOAD_CHAPTERS = 10;

export type AutoLoadReason = 'state' | 'settled' | 'sentinel' | 'visibility' | 'timer';

export type UnreadBufferState = 'empty' | 'pending' | 'short' | 'sufficient' | 'capped';

type AutoLoadDecision =
  { type: 'start' } | { type: 'schedule'; dueAt: number } | { type: 'idle'; clearTimer: boolean };

export interface AutoLoadPolicyInput {
  autoLoadInFlight: boolean;
  enabled: boolean;
  failureCooldownUntil: number;
  graceUntil: number;
  hasChapter: boolean;
  hasNext: boolean;
  isLoadingNext: boolean;
  isLoadingPrev: boolean;
  isNavigating: boolean;
  isNearBottom: boolean;
  now: number;
  pageHidden: boolean;
  unreadBufferState: UnreadBufferState;
}

export function isViewportNearBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  marginPx: number = INTERSECTION_ROOT_MARGIN_PX
): boolean {
  return scrollHeight - (scrollTop + clientHeight) <= marginPx;
}

export function decideAutoLoadNext(
  reason: AutoLoadReason,
  input: AutoLoadPolicyInput
): AutoLoadDecision {
  if (!canAutoLoadBase(input)) {
    return {
      type: 'idle',
      clearTimer:
        !input.enabled ||
        input.unreadBufferState === 'sufficient' ||
        input.unreadBufferState === 'capped',
    };
  }

  if (input.now < input.graceUntil) {
    return { type: 'schedule', dueAt: input.graceUntil };
  }

  if (input.now < input.failureCooldownUntil) {
    return shouldRetryAfterCooldown(reason)
      ? { type: 'schedule', dueAt: input.failureCooldownUntil }
      : { type: 'idle', clearTimer: false };
  }

  if (requiresNearBottom(reason) && !input.isNearBottom) {
    return { type: 'idle', clearTimer: false };
  }

  return { type: 'start' };
}

function canAutoLoadBase(input: AutoLoadPolicyInput): boolean {
  return (
    input.enabled &&
    input.hasChapter &&
    input.hasNext &&
    !input.isLoadingNext &&
    !input.isLoadingPrev &&
    !input.isNavigating &&
    !input.autoLoadInFlight &&
    !input.pageHidden &&
    (input.unreadBufferState === 'empty' || input.unreadBufferState === 'short')
  );
}

function shouldRetryAfterCooldown(reason: AutoLoadReason): boolean {
  return reason !== 'state';
}

function requiresNearBottom(reason: AutoLoadReason): boolean {
  return reason === 'settled' || reason === 'sentinel';
}
