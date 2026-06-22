'use client';

import { AppSection } from '@/components/app-section';
import { useTranslation } from '@/components/providers/i18n-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { cn } from '@/lib/utils';
import { Check, Monitor, Moon, Sun } from 'lucide-react';

const OPTIONS = [
  {
    value: 'light' as const,
    icon: Sun,
    preview: 'bg-[hsl(180_20%_98%)] text-[hsl(200_35%_10%)] border-slate-200',
    bar: 'bg-teal-600',
  },
  {
    value: 'dark' as const,
    icon: Moon,
    preview: 'bg-[hsl(200_35%_6%)] text-[hsl(180_20%_98%)] border-slate-700',
    bar: 'bg-teal-500',
  },
  {
    value: 'system' as const,
    icon: Monitor,
    preview: 'bg-gradient-to-br from-[hsl(180_20%_98%)] to-[hsl(200_35%_6%)] text-foreground border-slate-300',
    bar: 'bg-gradient-to-r from-teal-600 to-teal-400',
  },
];

export function AppearanceSettingsSection() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <AppSection
      title={t('settings.appearance.title')}
      description={t('settings.appearance.description')}
      contentClassName="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = theme === option.value;
          const hint =
            option.value === 'light'
              ? t('settings.appearance.lightHint')
              : option.value === 'dark'
                ? t('settings.appearance.darkHint')
                : t('settings.appearance.systemHint');

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              aria-pressed={selected}
              className={cn(
                'group relative overflow-hidden rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                selected
                  ? 'border-primary ring-1 ring-primary/20 shadow-sm'
                  : 'border-border hover:border-primary/40',
              )}
            >
              <div
                className={cn(
                  'mb-3 overflow-hidden rounded-lg border p-3',
                  option.preview,
                )}
                aria-hidden
              >
                <div className={cn('mb-2 h-1.5 w-8 rounded-full', option.bar)} />
                <div className="space-y-1.5 opacity-70">
                  <div className="h-1 w-full rounded bg-current/20" />
                  <div className="h-1 w-4/5 rounded bg-current/15" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span className="font-medium capitalize">{option.value}</span>
                </span>
                {selected ? (
                  <Check className="h-4 w-4 text-primary" aria-hidden />
                ) : null}
              </div>
              <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
            </button>
          );
        })}
      </div>
    </AppSection>
  );
}
