import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'ok-bot',
  tagline: '多 agent AI 助理框架',
  favicon: 'img/favicon.ico',

  url: 'https://ok-bot.dev',
  baseUrl: '/',

  organizationName: 'ok-bot',
  projectName: 'ok-bot',

  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'ok-bot',
      items: [
        { type: 'docSidebar', sidebarId: 'guideSidebar', position: 'left', label: '指南' },
        { type: 'docSidebar', sidebarId: 'apiSidebar', position: 'left', label: 'API 参考' },
        { href: 'https://github.com/ok-bot/ok-bot', label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `Copyright © ${new Date().getFullYear()} ok-bot`,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
