import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';

import { useTwoStepConfirm } from '@/ui/composables/useTwoStepConfirm';

describe('useTwoStepConfirm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const scope = effectScope();
    const confirmState = scope.run(() => useTwoStepConfirm<'cache' | 'clear'>())!;
    return { scope, ...confirmState };
  }

  it('runs an action only on the second click and then disarms', () => {
    const { armed, confirm } = setup();
    const run = vi.fn();

    confirm('cache', run);
    expect(run).not.toHaveBeenCalled();
    expect(armed.value).toBe('cache');

    confirm('cache', run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(armed.value).toBeNull();
  });

  it('re-arms for a different action instead of running the first', () => {
    const { armed, confirm } = setup();
    const cache = vi.fn();
    const clear = vi.fn();

    confirm('cache', cache);
    confirm('clear', clear);
    expect(armed.value).toBe('clear');
    expect(cache).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it('forgets an armed action after the confirmation window', () => {
    const { armed, confirm } = setup();
    const run = vi.fn();

    confirm('clear', run);
    vi.advanceTimersByTime(3999);
    expect(armed.value).toBe('clear');
    vi.advanceTimersByTime(1);
    expect(armed.value).toBeNull();

    confirm('clear', run);
    expect(run).not.toHaveBeenCalled();
  });

  it('drops the pending window when its owner is disposed', () => {
    const { scope, armed, confirm } = setup();

    confirm('cache', vi.fn());
    scope.stop();
    expect(armed.value).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
