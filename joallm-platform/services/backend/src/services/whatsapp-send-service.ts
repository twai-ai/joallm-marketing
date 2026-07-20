/**
 * Meta WhatsApp Cloud API send helpers (Platform Connector execution).
 */

import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export type WhatsAppSendResult = {
  ok: boolean;
  messageId?: string;
  response?: Record<string, unknown>;
  error?: string;
};

/** Send a WhatsApp text message via Graph API. */
export async function sendWhatsAppText(options: {
  to: string;
  body: string;
  phoneNumberId?: string;
  accessToken?: string;
}): Promise<WhatsAppSendResult> {
  const accessToken = options.accessToken || config.metaAccessToken;
  const phoneNumberId = options.phoneNumberId || config.metaPhoneNumberId;
  const to = options.to.replace(/\D/g, '');
  const body = options.body.trim();

  if (!accessToken || !phoneNumberId) {
    return { ok: false, error: 'META_ACCESS_TOKEN or META_PHONE_NUMBER_ID not configured' };
  }
  if (!to || !body) {
    return { ok: false, error: 'Recipient and body are required' };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: body.slice(0, 4000) },
        }),
      },
    );
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const err =
        typeof data.error === 'object' && data.error && 'message' in (data.error as object)
          ? String((data.error as { message?: string }).message)
          : `Graph API ${response.status}`;
      logger.error('WhatsApp send failed', data);
      return { ok: false, error: err, response: data };
    }

    const messages = data.messages as Array<{ id?: string }> | undefined;
    const messageId = messages?.[0]?.id;
    logger.info('WhatsApp message sent', { to, messageId });
    return { ok: true, messageId, response: data };
  } catch (error) {
    logger.error('WhatsApp send exception', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'WhatsApp send failed',
    };
  }
}
