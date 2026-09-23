import type { ObjectDirective } from 'vue';

/** Render processed chapter HTML without destroying existing nodes for joinHtml page appends. */
export const vChapterContent: ObjectDirective<HTMLElement, string> = {
  // Populate during patching: post-flush reader watchers cache chapter heights, so mounted /
  // updated hooks can run too late and leave a title-only height cached as a short chapter.
  beforeMount(element, { value }) {
    element.innerHTML = value;
  },
  beforeUpdate(element, { value, oldValue }) {
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
