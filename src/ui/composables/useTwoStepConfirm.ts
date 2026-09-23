import { onScopeDispose, shallowRef } from 'vue';

const CONFIRM_WINDOW_MS = 4000;

/**
 * Inline confirmation for costly or destructive actions: the first click arms an action and a
 * second click within a short window runs it, so no dialog ever blocks the page.
 */
export function useTwoStepConfirm<Action extends string>() {
  const armed = shallowRef<Action | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function disarm(): void {
    clearTimeout(timer);
    armed.value = null;
  }

  function confirm(action: Action, run: () => void): void {
    if (armed.value === action) {
      disarm();
      run();
      return;
    }
    clearTimeout(timer);
    armed.value = action;
    timer = setTimeout(disarm, CONFIRM_WINDOW_MS);
  }

  onScopeDispose(disarm);

  return { armed, confirm, disarm };
}
