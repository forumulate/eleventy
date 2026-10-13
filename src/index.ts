/**
 * @forumulate/eleventy — Forumulate in an Eleventy site.
 *
 *   import forumulate from '@forumulate/eleventy';
 *   export default (eleventyConfig) => {
 *     eleventyConfig.addPlugin(forumulate, { org: 'acme', space: 'blog' });
 *   };
 *
 * Shortcodes print the `<forumulate-*>` custom elements from @forumulate/embed
 * plus the module script that defines them (a browser runs a module URL once,
 * however many shortcodes a page has). `forumulateFeed` is rendered at BUILD
 * time with the same markup the element draws, so the list is in the HTML for
 * crawlers and no-JS readers, and refreshes itself on the client.
 */
import { feedHtml, fetchFeed, FEED_CSS, type FeedKind, type Theme } from '@forumulate/embed';
import { forumulateData, type ForumulateDataOptions } from './data.js';

export { forumulateData } from './data.js';
export type { ForumulateData, ForumulateDataOptions, KindSource, WithMarkdown } from './data.js';

/** The custom-elements bundle, from jsDelivr by default. Self-host it with `elementsSrc`. */
export const DEFAULT_ELEMENTS_SRC = 'https://cdn.jsdelivr.net/npm/@forumulate/embed@1';

export interface ForumulateEleventyOptions {
  /** Organization id or slug. */
  org: string;
  /** Default space for shortcodes that are not given one. */
  space?: string;
  apiBase?: string;
  theme?: Theme;
  locale?: string;
  accent?: string;
  radius?: string;
  width?: string;
  font?: string;
  /** Where the browser loads the element definitions from. */
  elementsSrc?: string;
  /**
   * Adds a global `forumulate` data object ({ pages, posts, topics, releases })
   * fetched once per build. Omit to add none.
   */
  data?: Omit<ForumulateDataOptions, 'org' | 'apiBase'>;
}

/** Shortcode arguments: an options object (Nunjucks `{% forumulateComments { topic: 'x' } %}`) or a space. */
type ShortcodeArg = string | Record<string, unknown> | undefined;

/** The slice of Eleventy's config API this plugin uses (Eleventy 2 and 3). */
export interface EleventyConfigLike {
  // Eleventy passes template-language values of any shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addShortcode(name: string, fn: (...args: any[]) => unknown): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addAsyncShortcode?(name: string, fn: (...args: any[]) => Promise<unknown>): void;
  addGlobalData?(name: string, value: unknown): void;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const ATTR: Record<string, string> = {
  org: 'org',
  space: 'space',
  apiBase: 'api',
  theme: 'theme',
  locale: 'locale',
  accent: 'accent',
  radius: 'radius',
  width: 'width',
  font: 'font',
  nonce: 'nonce',
  topic: 'topic',
  articleUrl: 'article-url',
  mode: 'mode',
  placeholder: 'placeholder',
  kind: 'kind',
  limit: 'limit',
  tag: 'tag',
  category: 'category',
  href: 'href',
  excerpts: 'excerpts',
};

function normalize(arg: ShortcodeArg): Record<string, unknown> {
  if (typeof arg === 'string') return { space: arg };
  if (!arg || typeof arg !== 'object') return {};
  // Nunjucks keyword arguments arrive as an object flagged `__keywords`.
  const { __keywords: _k, ...rest } = arg as Record<string, unknown>;
  return rest;
}

export default function forumulatePlugin(config: EleventyConfigLike, options: ForumulateEleventyOptions): void {
  if (!options?.org) throw new Error('[forumulate] the Eleventy plugin needs `org`');
  const { elementsSrc = DEFAULT_ELEMENTS_SRC, data, ...defaults } = options;
  const script = `<script type="module" src="${esc(elementsSrc)}"></script>`;

  const merged = (arg: ShortcodeArg) => {
    const o: Record<string, unknown> = { ...defaults, ...normalize(arg) };
    if (!o.space) throw new Error('[forumulate] shortcode needs a `space` (plugin option or argument)');
    return o;
  };
  const attrs = (o: Record<string, unknown>) =>
    Object.entries(ATTR)
      .filter(([k]) => o[k] !== undefined && o[k] !== null && o[k] !== '')
      .map(([k, name]) => ` ${name}="${esc(String(o[k]))}"`)
      .join('');
  const element = (tag: string, o: Record<string, unknown>, inner = '') => `<${tag}${attrs(o)}>${inner}</${tag}>${script}`;

  config.addShortcode('forumulateComments', (arg?: ShortcodeArg) => element('forumulate-comments', merged(arg)));
  config.addShortcode('forumulateWidget', (arg?: ShortcodeArg) => element('forumulate-widget', merged(arg)));
  config.addShortcode('forumulateSearch', (arg?: ShortcodeArg) => element('forumulate-search', merged(arg)));
  config.addShortcode('forumulateChangelog', (arg?: ShortcodeArg) => element('forumulate-changelog', merged(arg)));

  /** `{% forumulateFeed "posts", 5 %}` or `{% forumulateFeed { kind: 'topics', space: 'forum' } %}` */
  const feed = async (arg?: ShortcodeArg, limit?: number) => {
    const o = typeof arg === 'string' ? { ...merged(undefined), kind: arg } : merged(arg);
    if (limit != null) o.limit = Number(limit);
    const kind = (o.kind as FeedKind | undefined) ?? 'posts';
    const items = await fetchFeed({
      org: String(o.org),
      space: String(o.space),
      apiBase: o.apiBase as string | undefined,
      locale: o.locale as string | undefined,
      kind,
      limit: o.limit as number | undefined,
      tag: o.tag as string | undefined,
      category: o.category as string | undefined,
      href: o.href as string | undefined,
    });
    const inner = `<style data-forumulate-feed>${FEED_CSS}</style>${feedHtml(items, {
      locale: o.locale as string | undefined,
      excerpts: o.excerpts !== false && o.excerpts !== 'false',
    })}`;
    return element('forumulate-feed', { ...o, kind }, inner);
  };
  if (config.addAsyncShortcode) config.addAsyncShortcode('forumulateFeed', feed);
  else config.addShortcode('forumulateFeed', feed);

  if (data && config.addGlobalData) {
    let once: ReturnType<typeof forumulateData> | undefined;
    config.addGlobalData('forumulate', () => (once ??= forumulateData({ ...data, org: options.org, apiBase: options.apiBase })));
  }
}

export { forumulatePlugin };
