import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, nextTick, ref } from 'vue';
import { JSDOM } from 'jsdom';

import { useKeyboardShortcuts } from '@/ui/composables/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.com/',
      pretendToBeVisual: true,
    });

    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('triggers handler and supports preventDefault/stopPropagation', async () => {
    const onNext = vi.fn();
    const onBody = vi.fn();

    document.body.addEventListener('keydown', onBody);

    const Comp = defineComponent({
      setup() {
        useKeyboardShortcuts([
          { key: 'n', handler: onNext, preventDefault: true, stopPropagation: true },
        ]);
        return () => null;
      },
    });

    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const app = createApp(Comp);
    app.mount(mountEl);
    await nextTick();

    const e = new dom.window.KeyboardEvent('keydown', {
      key: 'n',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(e);

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
    // stopPropagation in capture phase should prevent the body bubble listener
    expect(onBody).toHaveBeenCalledTimes(0);

    app.unmount();
    mountEl.remove();
  });

  it('stops later same-target listeners when stopPropagation is requested', async () => {
    const onNext = vi.fn();
    const onWindow = vi.fn();

    const Comp = defineComponent({
      setup() {
        useKeyboardShortcuts([
          { key: 'arrowright', handler: onNext, preventDefault: true, stopPropagation: true },
        ]);
        return () => null;
      },
    });

    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const app = createApp(Comp);
    app.mount(mountEl);
    await nextTick();

    window.addEventListener('keydown', onWindow, { capture: true });

    document.body.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      })
    );

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onWindow).toHaveBeenCalledTimes(0);

    window.removeEventListener('keydown', onWindow, { capture: true });
    app.unmount();
    mountEl.remove();
  });

  it('consumes ignored repeats for discrete shortcuts while keeping continuous repeats enabled', async () => {
    const onPageTurn = vi.fn();
    const onLineScroll = vi.fn();

    const Comp = defineComponent({
      setup() {
        useKeyboardShortcuts([
          {
            key: ' ',
            handler: onPageTurn,
            preventDefault: true,
            allowRepeat: false,
          },
          { key: 'arrowdown', handler: onLineScroll },
        ]);
        return () => null;
      },
    });

    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const app = createApp(Comp);
    app.mount(mountEl);
    await nextTick();

    document.body.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    );
    const repeatedPageTurn = new dom.window.KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
      repeat: true,
    });
    document.body.dispatchEvent(repeatedPageTurn);
    document.body.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        repeat: true,
      })
    );

    expect(onPageTurn).toHaveBeenCalledTimes(1);
    expect(repeatedPageTurn.defaultPrevented).toBe(true);
    expect(onLineScroll).toHaveBeenCalledTimes(1);

    app.unmount();
    mountEl.remove();
  });

  it('ignores shortcuts in input elements by default (allowInInputs overrides)', async () => {
    const onNext = vi.fn();

    const Comp = defineComponent({
      setup() {
        useKeyboardShortcuts([
          { key: 'n', handler: onNext },
          { key: 'p', handler: onNext, allowInInputs: true },
        ]);
        return () => null;
      },
    });

    const input = document.createElement('input');
    document.body.appendChild(input);

    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const app = createApp(Comp);
    app.mount(mountEl);
    await nextTick();

    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    expect(onNext).toHaveBeenCalledTimes(0);

    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    expect(onNext).toHaveBeenCalledTimes(1);

    app.unmount();
    input.remove();
    mountEl.remove();
  });

  it('ignores shortcuts owned by editable controls inside Shadow DOM', async () => {
    const onIndex = vi.fn();

    const Comp = defineComponent({
      setup() {
        useKeyboardShortcuts([{ key: 'enter', handler: onIndex, preventDefault: true }]);
        return () => null;
      },
    });

    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const textarea = document.createElement('textarea');
    shadowRoot.appendChild(textarea);
    document.body.appendChild(host);

    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const app = createApp(Comp);
    app.mount(mountEl);
    await nextTick();

    textarea.focus();
    const enter = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    textarea.dispatchEvent(enter);

    expect(document.activeElement).toBe(host);
    expect(shadowRoot.activeElement).toBe(textarea);
    expect(onIndex).not.toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(false);

    app.unmount();
    host.remove();
    mountEl.remove();
  });

  it('ignores IME composition events before shortcut matching', async () => {
    const onIndex = vi.fn();

    const Comp = defineComponent({
      setup() {
        useKeyboardShortcuts([{ key: 'enter', handler: onIndex, preventDefault: true }]);
        return () => null;
      },
    });

    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const app = createApp(Comp);
    app.mount(mountEl);
    await nextTick();

    const enter = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    });
    document.body.dispatchEvent(enter);

    expect(onIndex).not.toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(false);

    app.unmount();
    mountEl.remove();
  });

  it('ignores modifier keys by default (allowModifiers overrides)', async () => {
    const onNext = vi.fn();

    const Comp = defineComponent({
      setup() {
        useKeyboardShortcuts([
          { key: 'n', handler: onNext },
          { key: 'm', handler: onNext, allowModifiers: true },
        ]);
        return () => null;
      },
    });

    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const app = createApp(Comp);
    app.mount(mountEl);
    await nextTick();

    document.body.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'n', bubbles: true, ctrlKey: true })
    );
    expect(onNext).toHaveBeenCalledTimes(0);

    document.body.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'm', bubbles: true, ctrlKey: true })
    );
    expect(onNext).toHaveBeenCalledTimes(1);

    app.unmount();
    mountEl.remove();
  });

  it('supports reactive enabled toggle', async () => {
    const onNext = vi.fn();
    const enabled = ref(false);

    const Comp = defineComponent({
      setup() {
        useKeyboardShortcuts([{ key: 'n', handler: onNext }], { enabled });
        return () => null;
      },
    });

    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const app = createApp(Comp);
    app.mount(mountEl);
    await nextTick();

    document.body.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'n', bubbles: true })
    );
    expect(onNext).toHaveBeenCalledTimes(0);

    enabled.value = true;
    await nextTick();

    document.body.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'n', bubbles: true })
    );
    expect(onNext).toHaveBeenCalledTimes(1);

    app.unmount();
    mountEl.remove();
  });

  it('leaves Enter/Space on a focused control to native activation', async () => {
    const onEnter = vi.fn();
    const onSpace = vi.fn();
    const onNext = vi.fn();

    const Comp = defineComponent({
      setup() {
        useKeyboardShortcuts([
          { key: 'enter', handler: onEnter, preventDefault: true },
          { key: ' ', handler: onSpace, preventDefault: true },
          { key: 'n', handler: onNext, preventDefault: true },
        ]);
        return () => null;
      },
    });

    const mountEl = document.createElement('div');
    document.body.appendChild(mountEl);
    const app = createApp(Comp);
    app.mount(mountEl);
    await nextTick();

    const button = document.createElement('button');
    document.body.appendChild(button);
    const press = (target: EventTarget, key: string) => {
      const e = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      target.dispatchEvent(e);
      return e;
    };

    expect(press(button, 'Enter').defaultPrevented).toBe(false);
    expect(press(button, ' ').defaultPrevented).toBe(false);
    expect(onEnter).not.toHaveBeenCalled();
    expect(onSpace).not.toHaveBeenCalled();

    const link = document.createElement('a');
    link.href = '/contents';
    document.body.appendChild(link);
    expect(press(link, 'Enter').defaultPrevented).toBe(false);
    expect(onEnter).not.toHaveBeenCalled();
    expect(press(link, ' ').defaultPrevented).toBe(true);
    expect(onSpace).toHaveBeenCalledTimes(1);
    onSpace.mockClear();
    link.remove();

    press(button, 'n');
    expect(onNext).toHaveBeenCalledTimes(1);

    press(document.body, 'Enter');
    press(document.body, ' ');
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onSpace).toHaveBeenCalledTimes(1);

    app.unmount();
    mountEl.remove();
    button.remove();
  });
});
