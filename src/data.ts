/**
 * Build-time content from the public read API, shaped for Eleventy data: a
 * plain object of arrays that templates loop over and `pagination` can page
 * through to emit one HTML file per post/page/topic/release.
 *
 * Markdown comes rendered by the API (`markdown: true`), so a site feeds it to
 * its own Markdown pipeline (`{{ post.markdown | markdownify }}` or similar)
 * rather than this package re-implementing the block renderer.
 */
import {
  createClient,
  type Article,
  type ArticleSummary,
  type ForumulateClient,
  type PageSummary,
  type Paged,
} from '@forumulate/embed';

export interface KindSource {
  /** Space id or slug holding this kind of content. */
  space: string;
  /** Max items. Default 100. */
  limit?: number;
  /** Also fetch each item's Markdown (one request per item). Default true. */
  markdown?: boolean;
  /** Only items with this tag (posts, topics). */
  tag?: string;
}

export interface ForumulateDataOptions {
  org: string;
  apiBase?: string;
  /** Docs locale for pages. */
  locale?: string;
  pages?: KindSource;
  posts?: KindSource;
  topics?: KindSource;
  releases?: KindSource;
}

export type WithMarkdown<T> = T & { markdown?: string };

export interface ForumulateData {
  pages: WithMarkdown<PageSummary>[];
  posts: WithMarkdown<ArticleSummary>[];
  topics: WithMarkdown<ArticleSummary>[];
  releases: WithMarkdown<Article>[];
}

/** Map with a small concurrency cap, so a 300-post blog is not 300 parallel requests. */
async function mapLimit<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

async function drain<T>(limit: number, page: (cursor?: string) => Promise<Paged<T>>): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;
  while (all.length < limit) {
    const p = await page(cursor);
    all.push(...p.items);
    if (!p.hasMore || !p.nextCursor) break;
    cursor = p.nextCursor;
  }
  return all.slice(0, limit);
}

/** A release's Markdown: the client has no helper for it, the route exists. */
async function releaseMarkdown(c: ForumulateClient, slug: string): Promise<string> {
  const url = `${c.apiBase}/public/orgs/${encodeURIComponent(c.org)}/spaces/${encodeURIComponent(c.space)}/changelog/t/${encodeURIComponent(slug)}.md`;
  const res = await fetch(url, { headers: { accept: 'text/markdown, text/plain' } });
  if (!res.ok) throw new Error(`[forumulate] ${res.status} on ${url}`);
  return res.text();
}

/**
 * Fetch every configured kind. Use it from a `_data/forumulate.js` file:
 *
 *   import { forumulateData } from '@forumulate/eleventy';
 *   export default () => forumulateData({ org: 'acme', posts: { space: 'blog' } });
 */
export async function forumulateData(o: ForumulateDataOptions): Promise<ForumulateData> {
  const client = (src: KindSource) => createClient({ org: o.org, space: src.space, apiBase: o.apiBase, locale: o.locale });
  const md = <T extends { slug: string }>(src: KindSource, items: T[], get: (slug: string) => Promise<string>) =>
    src.markdown === false
      ? Promise.resolve(items as WithMarkdown<T>[])
      : mapLimit(items, 6, async (it) => ({ ...it, markdown: await get(it.slug) }));

  const [pages, posts, topics, releases] = await Promise.all([
    (async () => {
      if (!o.pages) return [];
      const c = client(o.pages);
      const list = (await c.listPages()).filter((p) => !p.externalUrl).slice(0, o.pages.limit ?? 100);
      return md(o.pages, list, (s) => c.getPageMarkdown(s));
    })(),
    (async () => {
      if (!o.posts) return [];
      const src = o.posts;
      const c = client(src);
      const list = await drain(src.limit ?? 100, (cursor) => c.listPosts({ cursor, tag: src.tag, limit: 50 }));
      return md(src, list, (s) => c.getPostMarkdown(s));
    })(),
    (async () => {
      if (!o.topics) return [];
      const src = o.topics;
      const c = client(src);
      const list = await drain(src.limit ?? 100, (cursor) => c.listTopics({ cursor, tag: src.tag, limit: 50 }));
      return md(src, list, (s) => c.getTopicMarkdown(s));
    })(),
    (async () => {
      if (!o.releases) return [];
      const src = o.releases;
      const c = client(src);
      const list = await drain(src.limit ?? 100, (cursor) => c.listReleases({ cursor, limit: 50 }));
      return md(src, list, (s) => releaseMarkdown(c, s));
    })(),
  ]);
  return { pages, posts, topics, releases };
}
