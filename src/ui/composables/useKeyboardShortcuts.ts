/**
 * useKeyboardShortcuts - Composable for managing keyboard shortcuts
 *
 * Features:
 * - Declarative shortcut definitions
 * - Automatic input element detection (ignores shortcuts in inputs)
 * - Modifier key handling (ignores Ctrl/Alt/Meta by default)
 * - Per-shortcut override options
 * - Reactive enabled state
 */

import { computed, type MaybeRef, unref } from 'vue';
import { getDeepActiveElement } from '@/ui/focus';
import { useEventListener } from './useEventListener';

export interface ShortcutDefinition {
  /** Key(s) that trigger this shortcut. Use lowercase. */
  key: string | string[];
  /** Handler function called when shortcut is triggered. */
  handler: (e: KeyboardEvent) => void;
  /** Whether to call e.preventDefault(). Default: false */
  preventDefault?: boolean;
  /** Whether to call e.stopPropagation(). Default: false */
  stopPropagation?: boolean;
  /** Whether repeated keydown events may invoke the handler. Default: true */
  allowRepeat?: boolean;
  /** Allow this shortcut to trigger even with modifier keys (Ctrl/Alt/Meta). Default: false */
  allowModifiers?: boolean;
  /** Allow this shortcut to trigger in input elements. Default: false */
  allowInInputs?: boolean;
}

export interface UseKeyboardShortcutsOptions {
  /** Reactive boolean to enable/disable all shortcuts. */
  enabled?: MaybeRef<boolean>;
  /** Globally ignore key events in input elements. Default: true */
  ignoreInputs?: boolean;
  /** Globally ignore key events with modifier keys. Default: true */
  ignoreModifiers?: boolean;
}

/**
 * Check if an element is an input-like element where shortcuts should be ignored.
 */
function isInputElement(target: EventTarget | null): boolean {
  const element = target as Partial<HTMLElement> | null;
  const tagName = element?.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    element?.isContentEditable === true
  );
}

/**
 * Check whether the event is owned by an editable control.
 * Window listeners see a Shadow DOM host as event.target, so inspect the composed path first.
 */
function isEditableEvent(e: KeyboardEvent): boolean {
  const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
  if (path.some(isInputElement)) return true;
  if (path.length === 0 && isInputElement(e.target)) return true;
  return isInputElement(getDeepActiveElement());
}

const SPACE_CONTROL_SELECTOR = 'button, summary, [role="button"]';
const ENTER_CONTROL_SELECTOR = `${SPACE_CONTROL_SELECTOR}, a[href], [role="link"]`;

/**
 * Enter/Space on a focused control is native activation (e.g. a toolbar button kept focus after
 * a click), so it must not be consumed by reader shortcuts.
 */
function isControlActivationEvent(e: KeyboardEvent, key: string): boolean {
  if (key !== 'enter' && key !== ' ') return false;
  const selector = key === 'enter' ? ENTER_CONTROL_SELECTOR : SPACE_CONTROL_SELECTOR;
  const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
  return path.some(
    node =>
      typeof (node as Partial<Element> | null)?.matches === 'function' &&
      (node as Element).matches(selector)
  );
}

/**
 * Check if any modifier key (Ctrl/Alt/Meta) is pressed.
 * Note: Shift is not included as it's commonly used with letter keys.
 */
function hasModifiers(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.altKey || e.metaKey;
}

/**
 * Register keyboard shortcuts with automatic cleanup.
 *
 * @example
 * ```ts
 * useKeyboardShortcuts([
 *   { key: 'escape', handler: closeModal },
 *   { key: ['arrowleft', 'p'], handler: prevPage, preventDefault: true },
 *   { key: ['arrowright', 'n'], handler: nextPage, preventDefault: true },
 * ], { enabled: isReaderActive });
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutDefinition[],
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { enabled, ignoreInputs = true, ignoreModifiers = true } = options;

  const isEnabled = computed(() => {
    if (enabled === undefined) return true;
    return unref(enabled);
  });

  function handleKeyDown(ev: Event) {
    const e = ev as KeyboardEvent;
    // Check global enabled state
    if (!isEnabled.value) return;

    // IME key events never belong to reader navigation, even when the browser retargets them.
    if (e.isComposing) return;

    const key = e.key.toLowerCase();
    const editableEvent = isEditableEvent(e);
    if (isControlActivationEvent(e, key)) return;

    // Try to match a shortcut
    for (const shortcut of shortcuts) {
      const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];
      const normalizedKeys = keys.map(k => k.toLowerCase());

      // Check if key matches
      if (!normalizedKeys.includes(key)) continue;

      // Check input element restriction
      const shouldIgnoreInput = ignoreInputs && !shortcut.allowInInputs;
      if (shouldIgnoreInput && editableEvent) continue;

      // Check modifier key restriction
      const shouldIgnoreModifier = ignoreModifiers && !shortcut.allowModifiers;
      if (shouldIgnoreModifier && hasModifiers(e)) continue;

      // Execute handler
      if (shortcut.preventDefault) e.preventDefault();
      if (shortcut.stopPropagation) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
      if (e.repeat && shortcut.allowRepeat === false) return;
      shortcut.handler(e);

      // Only one shortcut per key event
      return;
    }
  }

  // Use capture phase to handle events before other listeners
  useEventListener('keydown', handleKeyDown, { capture: true });
}
