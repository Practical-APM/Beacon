/** Product demo screenshots served from /public/marketing/screenshots */
export const MARKETING_SCREENSHOTS = {
  dashboard: '/marketing/screenshots/dashboard.svg',
  project: '/marketing/screenshots/project.svg',
  integrations: '/marketing/screenshots/integrations.svg',
} as const;

export type MarketingScreenshotKey = keyof typeof MARKETING_SCREENSHOTS;

export const SCREENSHOT_ASPECT = 1200 / 720;
