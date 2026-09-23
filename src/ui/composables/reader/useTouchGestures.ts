/**
 * useTouchGestures - Composable for swipe gesture handling
 *
 * Resolves horizontal page swipes and vertical boundary pulls as one gesture.
 */

import { computed, type ComputedRef, ref } from 'vue';

// === Types ===
export type BoundaryGestureDirection = 'prev' | 'next';

type GestureStartState = {
  boundaryDirection: BoundaryGestureDirection | null;
  boundaryReady: boolean;
  swipeCancelled: boolean;
  swipeEnabled: boolean;
  id: number;
  x: number;
  y: number;
  time: number;
  threshold: number;
};

// === Constants ===
const SWIPE_MIN_THRESHOLD_PX = 72;
const SWIPE_MAX_THRESHOLD_PX = 120;
const SWIPE_VIEWPORT_RATIO = 0.18;
const SWIPE_MAX_DURATION_MS = 700;
const SWIPE_CANCEL_VERTICAL_PX = 28;
const SWIPE_AXIS_RATIO = 1.5;
// System back/forward gestures start at the screen edge; leave those to the browser.
const SWIPE_EDGE_GUARD_PX = 24;
const BOUNDARY_PULL_HINT_PX = 12;
const BOUNDARY_PULL_TRIGGER_PX = 48;
const BOUNDARY_AXIS_RATIO = 1.25;

function isInteractiveElement(target: unknown): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'a, button, input, textarea, select, label, summary, [contenteditable], [role="button"]'
    )
  );
}

function getSwipeThreshold(): number {
  return Math.min(
    SWIPE_MAX_THRESHOLD_PX,
    Math.max(SWIPE_MIN_THRESHOLD_PX, window.innerWidth * SWIPE_VIEWPORT_RATIO)
  );
}

export interface UseTouchGesturesOptions {
  swipeEnabled: ComputedRef<boolean>;
  getBoundaryDirection?: () => BoundaryGestureDirection | null;
  onBoundaryPull?: (direction: BoundaryGestureDirection) => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

export function useTouchGestures(options: UseTouchGesturesOptions) {
  const { swipeEnabled, getBoundaryDirection, onBoundaryPull, onSwipeLeft, onSwipeRight } = options;

  const boundaryGestureDirection = ref<BoundaryGestureDirection | null>(null);
  const boundaryGestureReady = ref(false);
  const boundaryGestureHint = computed(() => {
    const direction = boundaryGestureDirection.value;
    if (!direction) return '';
    if (direction === 'next') {
      return boundaryGestureReady.value ? '松手加载下一章' : '继续上滑加载下一章';
    }
    return boundaryGestureReady.value ? '松手加载上一章' : '继续下滑加载上一章';
  });

  let gestureStart: GestureStartState | null = null;

  function clearBoundaryFeedback(): void {
    boundaryGestureDirection.value = null;
    boundaryGestureReady.value = false;
  }

  function clearGesture(): void {
    gestureStart = null;
    clearBoundaryFeedback();
  }

  function handleTouchStart(e: TouchEvent) {
    clearGesture();
    if (e.touches.length !== 1) return;
    if (isInteractiveElement(e.target)) return;

    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;

    const touch = e.touches[0];
    const boundaryDirection = onBoundaryPull ? getBoundaryDirection?.() || null : null;
    const canSwipe =
      swipeEnabled.value &&
      touch.clientX >= SWIPE_EDGE_GUARD_PX &&
      touch.clientX <= window.innerWidth - SWIPE_EDGE_GUARD_PX;
    if (!canSwipe && !boundaryDirection) return;

    gestureStart = {
      boundaryDirection,
      boundaryReady: false,
      swipeCancelled: false,
      swipeEnabled: canSwipe,
      id: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      threshold: canSwipe ? getSwipeThreshold() : 0,
    };
  }

  function handleTouchMove(e: TouchEvent) {
    if (!gestureStart) return;
    if (e.touches.length !== 1) {
      clearGesture();
      return;
    }

    const touch = e.touches[0];
    if (touch.identifier !== gestureStart.id) return;

    const dx = touch.clientX - gestureStart.x;
    const dy = touch.clientY - gestureStart.y;

    // Cancel if it's clearly a vertical scroll gesture.
    if (
      gestureStart.swipeEnabled &&
      Math.abs(dy) >= SWIPE_CANCEL_VERTICAL_PX &&
      Math.abs(dy) >= Math.abs(dx) * SWIPE_AXIS_RATIO
    ) {
      gestureStart.swipeCancelled = true;
    }

    if (!gestureStart.boundaryDirection) return;
    if (
      Math.abs(dx) >= BOUNDARY_PULL_HINT_PX &&
      Math.abs(dx) > Math.abs(dy) * BOUNDARY_AXIS_RATIO
    ) {
      gestureStart.boundaryDirection = null;
      gestureStart.boundaryReady = false;
      clearBoundaryFeedback();
      return;
    }

    const pullDistance = gestureStart.boundaryDirection === 'next' ? -dy : dy;
    const showHint = pullDistance >= BOUNDARY_PULL_HINT_PX;
    gestureStart.boundaryReady = pullDistance >= BOUNDARY_PULL_TRIGGER_PX;
    boundaryGestureDirection.value = showHint ? gestureStart.boundaryDirection : null;
    boundaryGestureReady.value = showHint && gestureStart.boundaryReady;

    if (gestureStart.boundaryReady && e.cancelable) e.preventDefault();
  }

  function handleTouchEnd(e: TouchEvent): boolean {
    if (!gestureStart) return false;

    const start = gestureStart;
    clearGesture();

    if (start.boundaryDirection && start.boundaryReady && onBoundaryPull) {
      onBoundaryPull(start.boundaryDirection);
      return true;
    }

    if (!start.swipeEnabled || start.swipeCancelled || !swipeEnabled.value) return false;

    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return false;

    const touch = Array.from(e.changedTouches).find(t => t.identifier === start.id);
    if (!touch) return false;

    const dt = Date.now() - start.time;
    if (dt > SWIPE_MAX_DURATION_MS) return false;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(dx) < start.threshold) return false;
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) return false;

    // Reader UX: swipe left => page down, swipe right => page up.
    if (dx < 0) {
      onSwipeLeft();
    } else {
      onSwipeRight();
    }
    return true;
  }

  function handleTouchCancel() {
    clearGesture();
  }

  return {
    boundaryGestureDirection,
    boundaryGestureHint,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  };
}
