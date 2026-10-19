declare var unsafeWindow: Window;
declare var GM_info: GM_Information;

/** @deprecated use `console.log` instead */
declare function GM_log(...args: unknown[]): void;

declare function GM_addStyle(css: string): void;
declare function GM_getValue<T = unknown>(name: string, defaultValue?: T): T;
declare function GM_setValue<T = unknown>(name: string, value: T): void;
declare function GM_deleteValue(name: string): void;
declare function GM_listValues(): string[];

declare function GM_getResourceText(resourceName: string): string;
declare function GM_getResourceURL(resourceName: string): string;
declare function GM_openInTab(url: string, loadInBackground?: boolean): Window;
declare function GM_registerMenuCommand(
  caption: string,
  commandFunc: MenuCommandCallback,
  accessKey?: string
): void;
declare function GM_setClipboard(text: string): void;
declare function GM_xmlhttpRequest(
  details: GM_xmlhttpRequestOptions
): GmXhrReturn | GmXhrReturnSync;

interface GM_Information {
  script: GM_Script_Info;
  scriptMetaStr: string;
  scriptWillUpdate: boolean;
  version: string;
}

interface GM_Script_Info {
  name: string;
  namespace: string;
  description: string;
  version: string;
  includes: string[];
  excludes: string;
  matches: string;
  resources: unknown[];
  unwrap: boolean;
}

interface MenuCommandCallback {
  (...args: unknown[]): unknown;
}

interface xhrParams {
    /**
     * GET, POST, HEAD
     */
    method: string;
    url: string;

    /**
     * True: use `sendAsBinary`.
     */
    binary?: boolean;

    /**
     * Pass your `this` to here, if required.
     */
    context?: unknown;

    data?: string;

    headers?: Record<string, string>;

    user?: string;
    password?: string;

    /**
     * The entire Firefox UI will be locked and frozen until the request completes.
     * In this mode, more data will be available in the return value.
     */
    synchronous?: boolean;

    timeout?: number;
    withCredentials?: boolean;
    responseType?: 'arraybuffer';

    upload?: XhrUpload;

    /**
     * Example: text/html; charset=GBK
     */
    overrideMimeType?: string;

    onload: GmXhrEventCallback;
    onabort?: GmXhrEventCallback;
    onerror?: GmXhrEventCallback;
    onprogress?: GmXhrEventCallback;
    onreadystatechange?: GmXhrEventCallback;
    ontimeout?: GmXhrEventCallback;
}

interface XhrUpload {
    onabort?    (): void;
    onerror?    (): void;
    onload?     (): void;
    onprogress?: GmXhrProgressParams;
}

interface GmXhrEventCallback {
    (response: GmXhrResponse): void
}

interface GmXhrResponse {
  readyState: number;
  responseHeaders: string;
  responseText: string;
  response?: ArrayBuffer;
  status: number;
  statusText: string;
  context?: unknown;
  finalUrl: string;
}

interface GmXhrProgressParams {
    lengthComputable: boolean;
    loaded: number;
    total: number;
}

interface GmXhrReturn {
    abort: () => void;
}

interface GmXhrReturnSync extends GmXhrReturn {
  finalUrl: string;
  readyState: number;
  responseHeaders: string;
  responseText: string;
  status: number;
  statusText: string;
}

type GM_xmlhttpRequestOptions = xhrParams;
