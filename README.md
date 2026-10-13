# @forumulate/eleventy

Forumulate in an [Eleventy](https://www.11ty.dev) site: shortcodes for comments, search, the changelog bell and a content feed, plus your docs, blog posts, forum topics and releases as build-time data.

## Install

```sh
npm install @forumulate/eleventy
```

## Configure

```js
// eleventy.config.js
import forumulate from '@forumulate/eleventy';

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(forumulate, {
    org: 'acme',
    space: 'community', // default space for shortcodes
    theme: 'auto',
    // optional: a global `forumulate` data object, fetched once per build
    data: { posts: { space: 'blog' }, pages: { space: 'docs', markdown: true } },
  });
}
```

Options: `org` (required), `space`, `apiBase` (default `https://forumulate.com/api`; use your custom domain's `/api`), `theme` (`light` | `dark` | `auto`), `locale`, `accent`, `radius`, `width`, `font`, `elementsSrc` (where the browser loads the elements; jsDelivr by default, self-host it if you prefer), `data`.

## Shortcodes

```njk
{% forumulateComments %}
{% forumulateComments { space: "forum", topic: "welcome" } %}
{% forumulateWidget { space: "docs", mode: "ask" } %}
{% forumulateSearch { space: "docs" } %}
{% forumulateChangelog { space: "changelog" } %}
{% forumulateFeed "posts", 5 %}
```

Each prints the matching `<forumulate-*>` custom element and the module script that defines it. `forumulateFeed` is rendered at build time, so the list is already in the HTML for crawlers and readers without JavaScript; the element then refreshes it in the browser.

## Content at build time

With `data` set, templates get `forumulate.pages`, `forumulate.posts`, `forumulate.topics` and `forumulate.releases`. Each item includes `markdown` (rendered by the API) unless you set `markdown: false`. One page per post:

```njk
---
pagination: { data: forumulate.posts, size: 1, alias: post }
permalink: "/blog/{{ post.slug }}/"
---
<h1>{{ post.title }}</h1>
{{ post.markdown | renderContent("md") | safe }}
```

You can also fetch in a data file:

```js
// _data/blog.js
import { forumulateData } from '@forumulate/eleventy';
export default () => forumulateData({ org: 'acme', posts: { space: 'blog', limit: 50 } });
```

## Links

- [@forumulate/embed](https://github.com/forumulate/embed): the core, with the full list of framework packages
- Guides: https://forumulate.com/guides

## License

MIT

---

## About this repository

This repository is a public mirror, refreshed on each Forumulate release
(one commit per release). Pull requests are welcome; accepted changes are
applied upstream and arrive here with the next release.

- API reference: https://forumulate.com/reference
- Guides: https://forumulate.com/guides
- Community and support: https://forumulate.com/community
- Source: https://github.com/forumulate/eleventy
