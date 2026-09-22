// OpenCC exposes dictionary subpaths without TypeScript declarations.
declare module 'opencc-js/dict/*' {
  const dictionary: string;
  export default dictionary;
}

declare module 'opencc-js/to/cn' {
  import type { DictGroup } from 'opencc-js/core';
  const dictionaries: readonly DictGroup[];
  export default dictionaries;
}
