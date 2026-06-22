import { env } from '../../env.js';
import { logger } from '../../lib/logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(message: EmailMessage): Promise<'sent' | 'failed' | 'skipped'> {
  if (!message.to) return 'skipped';

  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
    logger.info('Notification email (mock)', {
      to: message.to,
      subject: message.subject,
      preview: message.text?.slice(0, 240),
    });
    return 'sent';
  }

  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    logger.warn('Email delivery skipped — configure RESEND_API_KEY and EMAIL_FROM', {
      to: message.to,
      subject: message.subject,
    });
    return 'failed';
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      logger.error('Resend email delivery failed', {
        status: res.status,
        detail: detail.slice(0, 500),
        to: message.to,
      });
      return 'failed';
    }

    return 'sent';
  } catch (error) {
    logger.error('Email delivery error', {
      message: error instanceof Error ? error.message : String(error),
      to: message.to,
    });
    return 'failed';
  }
}
