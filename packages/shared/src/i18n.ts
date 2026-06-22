export const SUPPORTED_LOCALES = ['en', 'es', 'de', 'fr'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
};

export const MESSAGE_KEYS = [
  'app.productName',
  'app.tagline',
  'nav.dashboard',
  'nav.integrations',
  'nav.settings',
  'nav.help',
  'nav.dashboardHint',
  'nav.integrationsHint',
  'nav.settingsHint',
  'nav.helpHint',
  'nav.signOut',
  'app.complianceNote',
  'dashboard.title',
  'dashboard.subtitle',
  'dashboard.riskFeed',
  'dashboard.loadMore',
  'dashboard.loadingMore',
  'dashboard.benchmarks.title',
  'dashboard.benchmarks.subtitle',
  'dashboard.benchmarks.optInHint',
  'dashboard.benchmarks.insufficientData',
  'dashboard.benchmarks.snapshotDate',
  'dashboard.benchmarks.p25',
  'dashboard.benchmarks.median',
  'dashboard.benchmarks.p75',
  'dashboard.benchmarks.vsMedian',
  'empty.noRisks.title',
  'empty.noRisks.subtitle',
  'empty.noRisks.detail',
  'settings.title',
  'settings.subtitle',
  'settings.language.title',
  'settings.language.description',
  'settings.language.saved',
  'settings.currency.title',
  'settings.currency.description',
  'settings.currency.label',
  'settings.currency.saved',
  'settings.appearance.title',
  'settings.appearance.description',
  'settings.appearance.lightHint',
  'settings.appearance.darkHint',
  'settings.appearance.systemHint',
  'dashboard.riskFeedTitle',
  'dashboard.riskFeedLead',
  'common.save',
  'common.saving',
  'common.loading',
] as const;

export type MessageKey = (typeof MESSAGE_KEYS)[number];

type MessageCatalog = Record<MessageKey, string>;

const EN_MESSAGES: MessageCatalog = {
  'app.productName': 'Beacon',
  'app.tagline': 'Customer implementation intelligence',
  'nav.dashboard': 'Portfolio',
  'nav.integrations': 'Connections',
  'nav.settings': 'Account',
  'nav.help': 'Help center',
  'nav.dashboardHint': 'See what needs attention today',
  'nav.integrationsHint': 'Connect Salesforce, Jira, Slack, and Calendar',
  'nav.settingsHint': 'Profile, privacy, and preferences',
  'nav.helpHint': 'Guides, FAQs, and troubleshooting',
  'nav.signOut': 'Sign out',
  'app.complianceNote': 'Open source. Privacy tools in Settings. No unearned certification claims.',
  'dashboard.title': 'Your implementation portfolio',
  'dashboard.subtitle':
    'A clear view of active customer go-lives, revenue at risk, and what to do next. No status meeting required.',
  'dashboard.riskFeed': 'Priority list',
  'dashboard.riskFeedTitle': 'Projects that need attention',
  'dashboard.riskFeedLead':
    'Sorted by severity and revenue impact. Open a project for root cause, predicted delay, and recommended actions.',
  'dashboard.loadMore': 'Load more',
  'dashboard.loadingMore': 'Loading…',
  'dashboard.benchmarks.title': 'Peer benchmarks',
  'dashboard.benchmarks.subtitle':
    'Compare your portfolio metrics against anonymized peer percentiles.',
  'dashboard.benchmarks.optInHint':
    'Enable benchmark participation in Settings to compare your portfolio against anonymized peers.',
  'dashboard.benchmarks.insufficientData':
    'Peer comparisons will appear once at least three organizations participate.',
  'dashboard.benchmarks.snapshotDate': 'Snapshot',
  'dashboard.benchmarks.p25': '25th percentile',
  'dashboard.benchmarks.median': 'Median',
  'dashboard.benchmarks.p75': '75th percentile',
  'dashboard.benchmarks.vsMedian': 'vs peer median',
  'empty.noRisks.title': 'Good news.',
  'empty.noRisks.subtitle': 'No implementation risks detected.',
  'empty.noRisks.detail': 'All active projects are progressing within expected thresholds.',
  'settings.title': 'Account & preferences',
  'settings.subtitle': 'Manage how Beacon works for you and your organization.',
  'settings.language.title': 'Language',
  'settings.language.description': 'Choose the language used across the app interface.',
  'settings.language.saved': 'Language preference saved.',
  'settings.currency.title': 'Currency display',
  'settings.currency.description':
    'Choose how revenue amounts are formatted. This does not convert currencies; it only changes number and symbol formatting.',
  'settings.currency.label': 'Number format',
  'settings.currency.saved': 'Currency display preference saved.',
  'settings.appearance.title': 'Appearance',
  'settings.appearance.description': 'Pick a theme that is comfortable for your workspace.',
  'settings.appearance.lightHint': 'Bright, clean default',
  'settings.appearance.darkHint': 'Low glare for long sessions',
  'settings.appearance.systemHint': 'Match your device setting',
  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.loading': 'Loading…',
};

const ES_MESSAGES: MessageCatalog = {
  ...EN_MESSAGES,
  'app.tagline': 'Centro de Riesgo de Implementación',
  'nav.dashboard': 'Panel',
  'nav.integrations': 'Integraciones',
  'nav.settings': 'Configuración',
  'nav.signOut': 'Cerrar sesión',
  'dashboard.title': 'Centro de Riesgo de Implementación',
  'dashboard.subtitle':
    'Supervise la salud de implementación, el impacto en ingresos y el riesgo de entrega en todos los clientes activos.',
  'dashboard.riskFeed': 'Feed de riesgos',
  'dashboard.loadMore': 'Cargar más',
  'dashboard.loadingMore': 'Cargando…',
  'empty.noRisks.title': 'Buenas noticias.',
  'empty.noRisks.subtitle': 'No se detectaron riesgos de implementación.',
  'empty.noRisks.detail':
    'Todos los proyectos activos avanzan dentro de los umbrales esperados.',
  'settings.title': 'Configuración',
  'settings.subtitle': 'Administre su perfil y organización.',
  'settings.language.title': 'Idioma',
  'settings.language.description': 'Elija el idioma de la aplicación web de Beacon.',
  'settings.language.saved': 'Preferencia de idioma guardada.',
  'common.save': 'Guardar',
  'common.saving': 'Guardando…',
  'common.loading': 'Cargando…',
};

const DE_MESSAGES: MessageCatalog = {
  ...EN_MESSAGES,
  'app.tagline': 'Implementierungs-Risikocenter',
  'nav.dashboard': 'Dashboard',
  'nav.integrations': 'Integrationen',
  'nav.settings': 'Einstellungen',
  'nav.signOut': 'Abmelden',
  'dashboard.title': 'Implementierungs-Risikocenter',
  'dashboard.subtitle':
    'Überwachen Sie Implementierungsgesundheit, Umsatzauswirkungen und Lieferrisiken aller aktiven Kunden.',
  'dashboard.riskFeed': 'Risiko-Feed',
  'dashboard.loadMore': 'Mehr laden',
  'dashboard.loadingMore': 'Wird geladen…',
  'empty.noRisks.title': 'Gute Nachrichten.',
  'empty.noRisks.subtitle': 'Keine Implementierungsrisiken erkannt.',
  'empty.noRisks.detail':
    'Alle aktiven Projekte liegen innerhalb der erwarteten Schwellenwerte.',
  'settings.title': 'Einstellungen',
  'settings.subtitle': 'Profil und Organisation verwalten.',
  'settings.language.title': 'Sprache',
  'settings.language.description': 'Sprache für die Beacon-Webanwendung wählen.',
  'settings.language.saved': 'Spracheinstellung gespeichert.',
  'common.save': 'Speichern',
  'common.saving': 'Speichern…',
  'common.loading': 'Laden…',
};

const FR_MESSAGES: MessageCatalog = {
  ...EN_MESSAGES,
  'app.tagline': 'Centre de risque d’implémentation',
  'nav.dashboard': 'Tableau de bord',
  'nav.integrations': 'Intégrations',
  'nav.settings': 'Paramètres',
  'nav.signOut': 'Se déconnecter',
  'dashboard.title': 'Centre de risque d’implémentation',
  'dashboard.subtitle':
    'Suivez la santé des implémentations, l’impact sur le revenu et les risques de livraison pour tous les clients actifs.',
  'dashboard.riskFeed': 'Flux de risques',
  'dashboard.loadMore': 'Charger plus',
  'dashboard.loadingMore': 'Chargement…',
  'empty.noRisks.title': 'Bonne nouvelle.',
  'empty.noRisks.subtitle': 'Aucun risque d’implémentation détecté.',
  'empty.noRisks.detail':
    'Tous les projets actifs progressent dans les seuils attendus.',
  'settings.title': 'Paramètres',
  'settings.subtitle': 'Gérez votre profil et votre organisation.',
  'settings.language.title': 'Langue',
  'settings.language.description': 'Choisissez la langue de l’application web Beacon.',
  'settings.language.saved': 'Préférence de langue enregistrée.',
  'common.save': 'Enregistrer',
  'common.saving': 'Enregistrement…',
  'common.loading': 'Chargement…',
};

export const MESSAGE_CATALOG: Record<SupportedLocale, MessageCatalog> = {
  en: EN_MESSAGES,
  es: ES_MESSAGES,
  de: DE_MESSAGES,
  fr: FR_MESSAGES,
};

export function normalizeLocale(value: string | null | undefined): SupportedLocale {
  if (!value) return DEFAULT_LOCALE;
  const base = value.toLowerCase().split('-')[0] ?? '';
  if ((SUPPORTED_LOCALES as readonly string[]).includes(base)) {
    return base as SupportedLocale;
  }
  return DEFAULT_LOCALE;
}

export function translate(
  locale: SupportedLocale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const catalog = MESSAGE_CATALOG[normalizeLocale(locale)];
  const template = catalog[key] ?? MESSAGE_CATALOG.en[key] ?? key;
  if (!params) return template;
  return Object.entries(params).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

export function listLocaleOptions(): Array<{ value: SupportedLocale; label: string }> {
  return SUPPORTED_LOCALES.map((value) => ({ value, label: LOCALE_LABELS[value] }));
}
