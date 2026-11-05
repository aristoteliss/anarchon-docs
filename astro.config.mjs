/* Copyright (C) 2026-present Aristotelis — see repository license. */

import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import mermaid from 'astro-mermaid';
import starlightThemeNova from 'starlight-theme-nova';

// Languages. English is the root locale: its pages live directly in src/content/docs/ and have no
// URL prefix. To add a language, add it here (e.g. el: { label: 'Ελληνικά', lang: 'el' }) and put its
// pages in src/content/docs/<code>/ with the same file names. See README.md.
const locales = {
  root: { label: 'English', lang: 'en' },
  el: { label: 'Ελληνικά', lang: 'el' },
};

// Group labels are translated here (translations: { el: '...' }); page labels come from each page's title.
const sidebar = [
  {
    label: 'Start here',
    translations: { el: 'Ξεκινήστε εδώ' },
    items: [
      'getting-started/introduction',
      'getting-started/installation',
      'getting-started/quick-start',
      'getting-started/core-concepts',
      'getting-started/choosing-anarchon',
    ],
  },
  {
    label: 'Guides',
    translations: { el: 'Οδηγοί' },
    items: [
      'guides/defining-jobs',
      'guides/decorators',
      'guides/attributes',
      'guides/job-options',
      'guides/scheduler-options',
      'guides/writing-handlers',
      'guides/run-data',
      'guides/lifecycle',
      'guides/events-and-logging',
      'guides/history',
    ],
  },
  {
    label: 'Backends',
    translations: { el: 'Backends' },
    items: [
      'backends/overview',
      'backends/redis',
      'backends/postgres',
      'backends/sqlserver',
      'backends/sqlite',
      'backends/rabbitmq',
      'backends/nats',
      'backends/brokers-and-leases',
      'backends/custom',
    ],
  },
  {
    label: 'How it works',
    translations: { el: 'Πώς λειτουργεί' },
    items: [
      'internals/architecture',
      'internals/run-lifecycle',
      'internals/claim-algorithms',
      'internals/leases',
      'internals/failure-scenarios',
      'internals/timing-and-clocks',
    ],
  },
  {
    label: 'Recipes',
    translations: { el: 'Συνταγές' },
    items: [
      'recipes/express',
      'recipes/nestjs',
      'recipes/aspnet-core',
      'recipes/worker-service',
      'recipes/worker-and-api',
      'recipes/kubernetes',
      'recipes/long-running-jobs',
      'recipes/several-services',
      'recipes/testing-and-debugging',
    ],
  },
  {
    label: 'Reference',
    translations: { el: 'Αναφορά' },
    items: ['reference/guarantees', 'reference/faq', 'reference/licensing'],
  },
  {
    label: 'Reference: Node.js',
    translations: { el: 'Αναφορά: Node.js' },
    items: [
      'reference/scheduler',
      'reference/decorators',
      'reference/options',
      'reference/events',
      'reference/types',
      'reference/errors',
    ],
  },
  {
    label: 'Reference: .NET',
    translations: { el: 'Αναφορά: .NET' },
    items: [
      'reference/dotnet/scheduler',
      'reference/dotnet/attributes',
      'reference/dotnet/options',
      'reference/dotnet/events',
      'reference/dotnet/hosting',
      'reference/dotnet/errors',
    ],
  },
];

const base = '/anarchon-docs';

// Top bar links, one per main sidebar group. Each gets the label and URL of the current language.
const navLink = (path, en, el) => ({
  label: { en, el },
  href: { en: `${base}/${path}/`, el: `${base}/el/${path}/` },
});
const nav = [
  navLink('getting-started/introduction', 'Start here', 'Ξεκινήστε εδώ'),
  navLink('guides/defining-jobs', 'Guides', 'Οδηγοί'),
  navLink('backends/overview', 'Backends', 'Backends'),
  navLink('internals/architecture', 'How it works', 'Πώς λειτουργεί'),
  navLink('recipes/express', 'Recipes', 'Συνταγές'),
  navLink('reference/guarantees', 'Reference', 'Αναφορά'),
];

// Social cards need an absolute URL: the image is public/og.png, rendered from assets/social-card.svg.
const socialCard = 'https://aristoteliss.github.io/anarchon-docs/og.png';

export default defineConfig({
  site: 'https://aristoteliss.github.io',
  base,
  integrations: [
    mermaid({ autoTheme: true }),
    starlight({
      title: 'anarchon',
      description:
        'Leaderless cron and interval scheduling for Node.js and .NET services, coordinated through your existing datastore.',
      defaultLocale: 'root',
      locales,
      sidebar,
      plugins: [starlightThemeNova({ nav })],
      // Links that share an icon are grouped into one dropdown by src/components/SocialIcons.astro.
      social: [
        {
          icon: 'github',
          label: 'anarchon for Node.js',
          href: 'https://github.com/aristoteliss/anarchon',
        },
        {
          icon: 'github',
          label: 'anarchon for .NET',
          href: 'https://github.com/aristoteliss/anarchon-dotnet',
        },
      ],
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: socialCard } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image:alt',
            content:
              'anarchon: leaderless cron and interval scheduling for Node.js and .NET',
          },
        },
        { tag: 'meta', attrs: { name: 'twitter:image', content: socialCard } },
      ],
      components: {
        Header: './src/components/Header.astro',
        SocialIcons: './src/components/SocialIcons.astro',
      },
      customCss: ['./src/styles/custom.css'],
      lastUpdated: true,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
    }),
  ],
});
