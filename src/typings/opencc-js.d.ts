// OpenCC exposes dictionary subpaths without TypeScript declarations.
declare module 'opencc-js/dict/*' {
  const dictionary: string;
  export default dictionary;
}
