import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, ref, watch, withDirectives } from 'vue';
import { joinHtml } from '@/core/utils';
import { vChapterContent } from '@/ui/components/reader/chapterContent';

const apps: ReturnType<typeof createApp>[] = [];
afterEach(() => apps.splice(0).forEach(app => app.unmount()));
function mount(html: string) {
  const content = ref(html);
  const app = createApp({
    render: () => withDirectives(h('div'), [[vChapterContent, content.value]]),
  });
  apps.push(app);
  const host = document.createElement('div');
  app.mount(host);
  return { content, element: host.firstElementChild! };
}
describe('chapter content rendering', () => {
  it('publishes chapter HTML before post-flush layout observers run', async () => {
    const chapters = ref(['<p>第一章</p>']);
    const host = document.createElement('div');
    const observed: string[][] = [];
    const app = createApp({
      setup() {
        // The reader measures appended chapters in a post-flush watcher and caches their height.
        watch(
          () => [...chapters.value],
          () => observed.push(Array.from(host.querySelectorAll('article'), el => el.innerHTML)),
          { flush: 'post' }
        );
        return () =>
          h(
            'main',
            chapters.value.map((html, id) =>
              withDirectives(h('article', { key: id }), [[vChapterContent, html]])
            )
          );
      },
    });
    apps.push(app);
    app.mount(host);

    chapters.value.push('<p>第二章正文</p>');
    await nextTick();
    expect(observed.at(-1)).toEqual(chapters.value);

    chapters.value[1] = '<p>第二章完整正文</p>';
    await nextTick();
    expect(observed.at(-1)).toEqual(chapters.value);
  });

  it('retains text and image nodes across page appends with the same final HTML', async () => {
    const first = '<p>第一页</p><img src="/illustration.png">';
    const { content, element } = mount(first);
    const paragraph = element.firstChild;
    const image = element.lastChild;
    content.value = joinHtml(first, '<p>第二页</p>');
    await nextTick();
    expect(element.firstChild).toBe(paragraph);
    expect(element.querySelector('img')).toBe(image);
    expect(element.innerHTML).toBe(content.value);
    content.value = joinHtml(content.value, '<p>第三页</p>');
    await nextTick();
    expect(element.firstChild).toBe(paragraph);
    expect(element.innerHTML).toBe(content.value);
  });
  it('replaces prior content when conversion, filtering or reload changes it', async () => {
    const { content, element } = mount('<p>头发</p><p>水印</p>');
    content.value = '<p>頭髮</p><p>水印</p>';
    await nextTick();
    expect(element.innerHTML).toBe(content.value);
    content.value = '<p>頭髮</p>';
    await nextTick();
    expect(element.textContent).toBe('頭髮');
    content.value = '';
    await nextTick();
    expect(element.childNodes).toHaveLength(0);
  });
});
