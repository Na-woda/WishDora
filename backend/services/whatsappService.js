// services/whatsappService.js
const axios = require('axios');

const WA_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

/**
 * Format phone number to E.164 (e.g. 0771234567 → +94771234567)
 * Handles Sri Lanka numbers but works for any country if already prefixed
 */
function formatPhone(phone) {
  if (!phone) return null;
  let p = phone.replace(/\s+/g, '').replace(/-/g, '');
  // If starts with 0 (local SL), replace with +94
  if (p.startsWith('0')) p = '+94' + p.slice(1);
  // If no + prefix, add +
  if (!p.startsWith('+')) p = '+' + p;
  return p;
}

/**
 * Send a WhatsApp text message via Meta Cloud API
 */
async function sendWhatsAppMessage(to, wish) {
  const phone = formatPhone(to);
  if (!phone) throw new Error('Invalid WhatsApp number');

  const messageBody = `🎉 *${wish.greeting}, ${wish.receiverName}!*\n\n` +
    `${wish.message}\n\n` +
    `_With warm wishes,_\n*${wish.senderName}*\n\n` +
    `💌 _Sent via WishDora_`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'text',
    text: {
      preview_url: false,
      body: messageBody,
    },
  };

  const response = await axios.post(WA_API_URL, payload, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`💬 WhatsApp sent to ${phone} | MsgID: ${response.data?.messages?.[0]?.id}`);
  return response.data;
}

/**
 * Send WhatsApp wish - used by the cron job
 */
async function sendWishWhatsApp(wish) {
  const phone = wish.receiverWhatsapp;
  return sendWhatsAppMessage(phone, wish);
}

module.exports = { sendWishWhatsApp, formatPhone };
