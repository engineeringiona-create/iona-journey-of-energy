/* Mirrors the real <section id="..."> blocks in index.html (home page)
   and the i18n keys (src/i18n/tr.json) each one's copy lives under —
   kept in sync by hand since the HTML has no machine-readable section
   registry. Add/remove an entry here when a home page section is
   added/removed in index.html. */
export const HOMEPAGE_SECTIONS = [
  {
    id: 'hero',
    label: 'Hero',
    fields: [
      { key: 'title', i18nKey: 'home.hero.slide1_title' },
      { key: 'subtitle', i18nKey: 'home.hero.slide1_sub' }
    ]
  },
  {
    id: 'about-teaser',
    label: 'Hakkımızda',
    fields: [
      { key: 'title', i18nKey: 'home.about.title' },
      { key: 'body', i18nKey: 'home.about.body' }
    ]
  },
  {
    id: 'ionaflux-teaser',
    label: 'IonaFlux',
    fields: [
      { key: 'title', i18nKey: 'home.ionaflux.title' },
      { key: 'body', i18nKey: 'home.ionaflux.body' }
    ]
  },
  {
    id: 'why-choose-us',
    label: 'Neden Iona',
    fields: [
      { key: 'title', i18nKey: 'home.why.title' },
      { key: 'body', i18nKey: 'home.why.body' }
    ]
  },
  {
    id: 'explore',
    label: 'Keşfedin',
    fields: [
      { key: 'eyebrow', i18nKey: 'home.explore.eyebrow' },
      { key: 'title', i18nKey: 'home.explore.title' }
    ]
  },
  {
    id: 'stats',
    label: 'İstatistikler',
    fields: [
      { key: 'experience_label', i18nKey: 'stats.experience_label' },
      { key: 'projects_label', i18nKey: 'stats.projects_label' },
      { key: 'offices_label', i18nKey: 'stats.offices_label' },
      { key: 'engineers_label', i18nKey: 'stats.engineers_label' }
    ]
  }
];
