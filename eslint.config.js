import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import vuePlugin from 'eslint-plugin-vue';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import vueParser from 'vue-eslint-parser';

export default [
  // Base JavaScript configuration
  js.configs.recommended,
  // Global globals for UserScript environment
  {
    languageOptions: {
      globals: {
        // Browser globals
        console: true,
        document: true,
        window: true,
        location: true,
        history: true,
        navigator: true,
        localStorage: true,
        fetch: true,
        setTimeout: true,
        clearTimeout: true,
        setInterval: true,
        clearInterval: true,
        alert: true,
        prompt: true,
        atob: true,
        getComputedStyle: true,
        getSelection: true,
        // DOM types
        Blob: true,
        DOMParser: true,
        Element: true,
        Event: true,
        FileReader: true,
        HTMLElement: true,
        Image: true,
        KeyboardEvent: true,
        MouseEvent: true,
        MutationObserver: true,
        Node: true,
        NodeFilter: true,
        NodeList: true,
        URL: true,
        WheelEvent: true,
        XPathResult: true,
        CSSFontFaceRule: true,
        // Speech API
        SpeechSynthesisUtterance: true,
        speechSynthesis: true,
        // UserScript APIs (Tampermonkey/Greasemonkey)
        GM: true,
        GM_addStyle: true,
        GM_deleteValue: true,
        GM_getValue: true,
        GM_info: true,
        GM_listValues: true,
        GM_openInTab: true,
        GM_registerMenuCommand: true,
        GM_setClipboard: true,
        GM_setValue: true,
        GM_xmlhttpRequest: true,
        unsafeWindow: true,
      },
    },
  },
  // TypeScript configuration (non-Vue files)
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/*.d.ts'],
    plugins: {
      '@typescript-eslint': ts,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      ...ts.configs.recommended.rules,
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'sort-imports': [
        'warn',
        {
          ignoreCase: true,
          ignoreDeclarationSort: false,
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
          allowSeparatedGroups: true,
        },
      ],
    },
  },
  // Type definitions
  {
    files: ['**/*.d.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
  // Vue configuration
  {
    files: ['**/*.vue'],
    plugins: {
      vue: vuePlugin,
      '@typescript-eslint': ts,
    },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      ...vuePlugin.configs.recommended.rules,
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  // Prettier integration
  {
    files: ['**/*.js', '**/*.ts', '**/*.tsx', '**/*.vue'],
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'warn',
    },
  },
  // Test files — allow `any` for partial store mocks
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '.test/**',
      '.tmp/**',
      'test-results/**',
      '*.min.js',
      '*.log',
      '.vscode/**',
      '.github/**',
      'src/typings/**',
      'scripts/**',
    ],
  },
];
