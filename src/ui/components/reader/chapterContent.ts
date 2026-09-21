import type { ObjectDirective } from 'vue';

/** Render processed chapter HTML without destroying existing nodes for joinHtml page appends. */
export const vChapterContent: ObjectDirective<HTMLElement, string> = {
  mounted(element, { value }) {
    element.innerHTML = value;
  },
  updated(element, { value, oldValue }) {
    if (value === oldValue) return;
    // Section pages are complete HTML fragments joined with this paragraph separator.
    // Conversion, filtering and reloads that change earlier content take the replacement path.
    if (oldValue && value.startsWith(`${oldValue}<p></p>`)) {
      element.insertAdjacentHTML('beforeend', value.slice(oldValue.length));
    } else {
      element.innerHTML = value;
    }
  },
};
