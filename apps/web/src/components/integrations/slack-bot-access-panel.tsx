'use client';

import {
  integrationWarningClass,
  integrationWarningTitleClass,
} from '@/lib/integration-status-styles';

type SlackBotSignal = {
  channelId: string;
  channelName: string | null;
  botPresent: boolean;
  botAccessError?: string | null;
};

type SlackChannelSuggestion = {
  channelId: string;
  channelName: string;
  botPresent: boolean;
};

export function SlackBotAccessPanel({
  connected,
  inaccessibleSignals,
  suggestions,
}: {
  connected: boolean;
  inaccessibleSignals: SlackBotSignal[];
  suggestions: SlackChannelSuggestion[];
}) {
  if (!connected) return null;

  const channelsMissingBot = suggestions.filter((item) => !item.botPresent);

  if (inaccessibleSignals.length === 0 && channelsMissingBot.length === 0) {
    return null;
  }

  return (
    <div className={`mt-4 ${integrationWarningClass()}`}>
      <p className={integrationWarningTitleClass()}>Invite the Beacon bot before mapping channels</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Open each Slack channel you plan to map</li>
        <li>
          Run <code className="rounded bg-muted px-1 py-0.5">/invite @Beacon</code> in private
          channels
        </li>
        <li>Return here and run a Slack sync to refresh bot status</li>
      </ol>
      {inaccessibleSignals.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {inaccessibleSignals.map((signal) => (
            <li key={signal.channelId}>
              #{signal.channelName ?? signal.channelId} —{' '}
              {signal.botAccessError === 'not_in_private_channel'
                ? 'Bot not in channel'
                : (signal.botAccessError ?? 'bot missing')}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {channelsMissingBot.length} channel
          {channelsMissingBot.length === 1 ? '' : 's'} still need the bot before response-gap
          signals can run.
        </p>
      )}
    </div>
  );
}
