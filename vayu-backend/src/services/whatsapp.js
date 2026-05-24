const twilio = require("twilio");

let _client;
function getTwilioClient() {
  if (!_client) {
    _client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return _client;
}

const FROM = process.env.TWILIO_WA_FROM || "whatsapp:+14155238886";

/**
 * Send a WhatsApp message via Twilio sandbox.
 * Sends Nepali text by default; falls back to English if Nepali is absent.
 *
 * @param {string}   to         - E.164 phone number e.g. "+977-98XXXXXXXX"
 * @param {string}   messageNe  - Nepali script advisory (primary, under 900 chars)
 * @param {string}   messageEn  - English advisory (fallback)
 * @param {string}   priority   - "normal" | "urgent"
 * @returns {{ delivery_status: string, sid: string, to: string }}
 */
async function sendWhatsApp(to, messageNe, messageEn, priority = "normal") {
  const body = (messageNe || messageEn || "").slice(0, 900);
  const toWa = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn("[WHATSAPP] Twilio credentials not set — message not sent");
    return { delivery_status: "skipped_no_credentials", sid: null, to };
  }

  try {
    const message = await getTwilioClient().messages.create({
      from: FROM,
      to:   toWa,
      body,
    });
    console.log(`[WHATSAPP] sent to ${to} sid=${message.sid} status=${message.status}`);
    return { delivery_status: message.status, sid: message.sid, to };
  } catch (e) {
    console.error("[WHATSAPP] send error:", e.message);
    return { delivery_status: "failed", error: e.message, to };
  }
}

/**
 * Send to multiple recipients; returns array of delivery results.
 */
async function sendWhatsAppBulk(recipients, messageNe, messageEn, priority = "normal") {
  return Promise.all(
    recipients.map((r) => sendWhatsApp(r, messageNe, messageEn, priority))
  );
}

/**
 * Re-fetch each Twilio message by SID to find its real final status.
 * Twilio sandbox returns "queued" for messages to phones that haven't opted in,
 * then silently transitions them to "undelivered" or "failed" with error code 63016.
 *
 * @param {Array<{sid?: string, to: string, delivery_status: string}>} results
 * @returns {Promise<Array<{to: string, sid: string|null, final_status: string, error_code: number|null}>>}
 */
async function verifyDeliveryStatus(results) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return results.map((r) => ({ to: r.to, sid: r.sid, final_status: r.delivery_status, error_code: null }));
  }
  const client = getTwilioClient();
  return Promise.all(
    results.map(async (r) => {
      if (!r.sid) {
        return { to: r.to, sid: null, final_status: r.delivery_status || "no_sid", error_code: null };
      }
      try {
        const msg = await client.messages(r.sid).fetch();
        return {
          to: r.to,
          sid: r.sid,
          final_status: msg.status,           // queued|sending|sent|delivered|undelivered|failed|read
          error_code:   msg.errorCode || null, // 63016 = recipient not opted in (sandbox)
        };
      } catch (e) {
        return { to: r.to, sid: r.sid, final_status: "fetch_error", error_code: null, error: e.message };
      }
    })
  );
}

module.exports = { sendWhatsApp, sendWhatsAppBulk, verifyDeliveryStatus };
