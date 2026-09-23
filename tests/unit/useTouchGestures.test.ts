import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import { JSDOM } from 'jsdom';

import {
  useTouchGestures,
  type UseTouchGesturesOptions,
} from '@/ui/composables/reader/useTouchGestures';

describe('useTouchGestures', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/',
      pretendToBeVisual: true,
    });

    // test env
    vi.stubGlobal('window', dom.window);
    // test env
    vi.stubGlobal('document', dom.window.document);
    // test env
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    // test env
    vi.stubGlobal('Element', dom.window.Element);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function makeTouchEvent(
    type: string,
    touches: Array<{ identifier: number; clientX: number; clientY: number }>,
    changedTouches?: Array<{ identifier: number; clientX: number; clientY: number }>,
    target?: unknown
  ): TouchEvent {
    const e = new dom.window.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'touches', { value: touches });
    Object.defineProperty(e, 'changedTouches', { value: changedTouches || touches });
    Object.defineProperty(e, 'target', { value: target || document.body, writable: false });
    return e as unknown as TouchEvent;
  }

  function createGestures(overrides: Partial<UseTouchGesturesOptions> = {}) {
    const onSwipeLeft = overrides.onSwipeLeft || vi.fn();
    const onSwipeRight = overrides.onSwipeRight || vi.fn();
    const gestures = useTouchGestures({
      swipeEnabled: computed(() => true),
      ...overrides,
      onSwipeLeft,
      onSwipeRight,
    });
    return { ...gestures, onSwipeLeft, onSwipeRight };
  }

  it('detects left swipe and calls onSwipeLeft', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);

    const { onSwipeLeft, onSwipeRight, handleTouchStart, handleTouchEnd } = createGestures();

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 300, clientY: 200 }]));
    expect(
      handleTouchEnd(
        makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 100, clientY: 200 }])
      )
    ).toBe(true);

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('detects right swipe and calls onSwipeRight', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);

    const { onSwipeLeft, onSwipeRight, handleTouchStart, handleTouchEnd } = createGestures();

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 100, clientY: 200 }]));
    expect(
      handleTouchEnd(
        makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 300, clientY: 200 }])
      )
    ).toBe(true);

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('commits a vertical boundary pull without requiring horizontal swipes', () => {
    const onBoundaryPull = vi.fn();
    const {
      boundaryGestureDirection,
      boundaryGestureHint,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
    } = createGestures({
      swipeEnabled: computed(() => false),
      getBoundaryDirection: () => 'next',
      onBoundaryPull,
    });

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 195, clientY: 500 }]));
    const move = makeTouchEvent('touchmove', [{ identifier: 0, clientX: 195, clientY: 430 }]);
    handleTouchMove(move);

    expect(boundaryGestureDirection.value).toBe('next');
    expect(boundaryGestureHint.value).toBe('松手加载下一章');
    expect(move.defaultPrevented).toBe(true);
    expect(
      handleTouchEnd(
        makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 195, clientY: 430 }])
      )
    ).toBe(true);
    expect(onBoundaryPull).toHaveBeenCalledWith('next');
    expect(boundaryGestureHint.value).toBe('');
  });

  it('shows boundary progress without committing below the pull threshold', () => {
    const onBoundaryPull = vi.fn();
    const { boundaryGestureHint, handleTouchStart, handleTouchMove, handleTouchEnd } =
      createGestures({ getBoundaryDirection: () => 'prev', onBoundaryPull });

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 195, clientY: 300 }]));
    handleTouchMove(makeTouchEvent('touchmove', [{ identifier: 0, clientX: 195, clientY: 325 }]));

    expect(boundaryGestureHint.value).toBe('继续下滑加载上一章');
    expect(
      handleTouchEnd(
        makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 195, clientY: 325 }])
      )
    ).toBe(false);
    expect(onBoundaryPull).not.toHaveBeenCalled();
    expect(boundaryGestureHint.value).toBe('');
  });

  it('cancels boundary tracking when the gesture becomes a horizontal swipe', () => {
    const onBoundaryPull = vi.fn();
    const {
      onSwipeLeft,
      boundaryGestureDirection,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
    } = createGestures({ getBoundaryDirection: () => 'next', onBoundaryPull });

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 300, clientY: 200 }]));
    handleTouchMove(makeTouchEvent('touchmove', [{ identifier: 0, clientX: 200, clientY: 195 }]));
    handleTouchEnd(makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 100, clientY: 195 }]));

    expect(boundaryGestureDirection.value).toBeNull();
    expect(onBoundaryPull).not.toHaveBeenCalled();
    expect(onSwipeLeft).toHaveBeenCalledOnce();
  });

  it('ignores swipe when disabled', () => {
    const { onSwipeLeft, onSwipeRight, handleTouchStart, handleTouchEnd } = createGestures({
      swipeEnabled: computed(() => false),
    });

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 300, clientY: 200 }]));
    handleTouchEnd(makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 100, clientY: 200 }]));

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('ignores short swipes (below threshold)', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);

    const { onSwipeLeft, onSwipeRight, handleTouchStart, handleTouchEnd } = createGestures();

    // Move only 50px (below the 72px minimum threshold)
    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 200, clientY: 200 }]));
    handleTouchEnd(makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 150, clientY: 200 }]));

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('cancels swipe on vertical movement', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);

    const { onSwipeLeft, handleTouchStart, handleTouchMove, handleTouchEnd } = createGestures();

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 300, clientY: 100 }]));
    // Move vertically significantly
    handleTouchMove(makeTouchEvent('touchmove', [{ identifier: 0, clientX: 290, clientY: 200 }]));
    handleTouchEnd(makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 100, clientY: 200 }]));

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('ignores multi-touch events', () => {
    const { onSwipeLeft, handleTouchStart } = createGestures();

    handleTouchStart(
      makeTouchEvent('touchstart', [
        { identifier: 0, clientX: 300, clientY: 200 },
        { identifier: 1, clientX: 100, clientY: 200 },
      ])
    );
    // swipeStart should be null, so subsequent end won't trigger anything
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('ignores swipe when text is selected', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'selected text',
    } as Selection);

    const { onSwipeLeft, handleTouchStart, handleTouchEnd } = createGestures();

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 300, clientY: 200 }]));
    handleTouchEnd(makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 100, clientY: 200 }]));

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('ignores slow swipes (exceeds max duration)', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);
    vi.useFakeTimers();

    const { onSwipeLeft, handleTouchStart, handleTouchEnd } = createGestures();

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 300, clientY: 200 }]));

    vi.advanceTimersByTime(800); // SWIPE_MAX_DURATION_MS is 700

    handleTouchEnd(makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 100, clientY: 200 }]));

    expect(onSwipeLeft).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('ignores touchmove when multi-touch appears mid-gesture', () => {
    const { handleTouchStart, handleTouchMove } = createGestures();

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 300, clientY: 200 }]));
    // Multi-touch during move → cancels
    handleTouchMove(
      makeTouchEvent('touchmove', [
        { identifier: 0, clientX: 290, clientY: 200 },
        { identifier: 1, clientX: 100, clientY: 100 },
      ])
    );
    // No assertion on onSwipeLeft — the swipeStart is nullified
  });

  it('handleTouchCancel resets state', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);

    const { onSwipeLeft, handleTouchStart, handleTouchCancel, handleTouchEnd } = createGestures();

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 300, clientY: 200 }]));
    handleTouchCancel();
    handleTouchEnd(makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 100, clientY: 200 }]));

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('ignores swipe starting on interactive elements', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);

    const { onSwipeLeft, handleTouchStart, handleTouchEnd } = createGestures();

    const button = document.createElement('button');
    document.body.appendChild(button);

    handleTouchStart(
      makeTouchEvent(
        'touchstart',
        [{ identifier: 0, clientX: 300, clientY: 200 }],
        undefined,
        button
      )
    );
    handleTouchEnd(makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 100, clientY: 200 }]));

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('ignores swipe starting inside an element with button semantics', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);

    const { onSwipeLeft, handleTouchStart, handleTouchEnd } = createGestures();

    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    const child = document.createElement('span');
    button.appendChild(child);
    document.body.appendChild(button);

    handleTouchStart(
      makeTouchEvent(
        'touchstart',
        [{ identifier: 0, clientX: 300, clientY: 200 }],
        undefined,
        child
      )
    );
    handleTouchEnd(makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 100, clientY: 200 }]));

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('adapts the swipe distance to the viewport width', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });

    const { onSwipeLeft, handleTouchStart, handleTouchEnd } = createGestures();

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 200, clientY: 200 }]));
    handleTouchEnd(makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 126, clientY: 200 }]));
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'innerWidth', { value: 1_000, configurable: true });
    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 300, clientY: 200 }]));
    handleTouchEnd(makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 200, clientY: 200 }]));
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('leaves edge swipes to system back gestures but keeps boundary pulls there', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    const onBoundaryPull = vi.fn();
    const { onSwipeLeft, onSwipeRight, handleTouchStart, handleTouchEnd } = createGestures({
      getBoundaryDirection: () => null,
      onBoundaryPull,
    });

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 10, clientY: 200 }]));
    expect(
      handleTouchEnd(
        makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 250, clientY: 200 }])
      )
    ).toBe(false);
    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 380, clientY: 200 }]));
    expect(
      handleTouchEnd(
        makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 140, clientY: 200 }])
      )
    ).toBe(false);
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();

    const pull = createGestures({ getBoundaryDirection: () => 'next', onBoundaryPull });
    pull.handleTouchStart(
      makeTouchEvent('touchstart', [{ identifier: 0, clientX: 10, clientY: 500 }])
    );
    pull.handleTouchMove(
      makeTouchEvent('touchmove', [{ identifier: 0, clientX: 10, clientY: 430 }])
    );
    expect(
      pull.handleTouchEnd(
        makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 10, clientY: 430 }])
      )
    ).toBe(true);
    expect(onBoundaryPull).toHaveBeenCalledWith('next');
  });

  it('ignores swipe where vertical movement dominates at the end', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);

    const { onSwipeLeft, handleTouchStart, handleTouchEnd } = createGestures();

    // dx = -100, dy = 200 → abs(dx) < abs(dy) * 1.5 → rejected
    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 300, clientY: 100 }]));
    handleTouchEnd(makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 200, clientY: 300 }]));

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('handleTouchEnd does nothing when no swipe was started', () => {
    const { onSwipeLeft, handleTouchEnd } = createGestures();

    handleTouchEnd(makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 100, clientY: 200 }]));

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('handleTouchEnd ignores when changedTouches does not contain matching identifier', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);

    const { onSwipeLeft, handleTouchStart, handleTouchEnd } = createGestures();

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 300, clientY: 200 }]));
    handleTouchEnd(
      makeTouchEvent('touchend', [], [{ identifier: 99, clientX: 100, clientY: 200 }])
    );

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('handleTouchMove ignores when touch identifier does not match', () => {
    const { handleTouchStart, handleTouchMove } = createGestures();

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 300, clientY: 200 }]));
    // Move with different identifier
    handleTouchMove(makeTouchEvent('touchmove', [{ identifier: 5, clientX: 290, clientY: 400 }]));
    // The swipe should not be cancelled since the move didn't match
  });

  it('handleTouchEnd with disabled composable after start (via ref)', () => {
    const enabledRef = ref(true);
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);

    const { onSwipeLeft, handleTouchStart, handleTouchEnd } = createGestures({
      swipeEnabled: computed(() => enabledRef.value),
    });

    handleTouchStart(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 300, clientY: 200 }]));

    enabledRef.value = false;

    handleTouchEnd(makeTouchEvent('touchend', [], [{ identifier: 0, clientX: 100, clientY: 200 }]));

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
