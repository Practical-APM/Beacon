import { siGooglecalendar, siJira } from 'simple-icons';
import { cn } from '@/lib/utils';

export type IntegrationBrandId = 'salesforce' | 'jira' | 'slack' | 'google-calendar';

const SLACK_MARK = [
  { fill: '#E01E5A', d: 'M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z' },
  { fill: '#36C5F0', d: 'M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z' },
  { fill: '#2EB67D', d: 'M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z' },
  { fill: '#ECB22E', d: 'M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.528 2.528 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z' },
] as const;

const SALESFORCE_CLOUD =
  'M10.006 5.415a4.195 4.195 0 0 1 3.045-1.306 4.238 4.238 0 0 1 3.96 2.734 4.993 4.993 0 0 1 2.208-.515 5.037 5.037 0 0 1 4.894 6.277 3.594 3.594 0 0 1 .332 6.937 4.003 4.003 0 0 1-.54.037 4.648 4.648 0 0 1-4.438-3.269 4.177 4.177 0 0 1-7.711.051 4.988 4.988 0 0 1-4.412 2.724 4.94 4.94 0 0 1-4.886-5.786 3.68 3.68 0 0 1 3.636-4.884 3.58 3.58 0 0 1 .912-.001z';

type IntegrationBrandIconProps = {
  brand: IntegrationBrandId;
  className?: string;
  size?: number;
};

export function IntegrationBrandIcon({ brand, className, size = 28 }: IntegrationBrandIconProps) {
  const dim = { width: size, height: size };

  if (brand === 'slack') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={cn('shrink-0', className)} {...dim}>
        {SLACK_MARK.map((part) => (
          <path key={part.fill} d={part.d} fill={part.fill} />
        ))}
      </svg>
    );
  }

  if (brand === 'salesforce') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={cn('shrink-0', className)} {...dim}>
        <path d={SALESFORCE_CLOUD} fill="#00A1E0" />
      </svg>
    );
  }

  if (brand === 'jira') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={cn('shrink-0', className)} {...dim}>
        <path d={siJira.path} fill={`#${siJira.hex}`} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('shrink-0', className)} {...dim}>
      <path d={siGooglecalendar.path} fill={`#${siGooglecalendar.hex}`} />
    </svg>
  );
}
