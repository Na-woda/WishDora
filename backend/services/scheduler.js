// services/scheduler.js
const cron = require('node-cron');
const Wish = require('../models/Wish');
const GreetingCard = require('../models/GreetingCard');
const { sendWishEmail } = require('./emailService');
const { sendWishWhatsApp } = require('./whatsappService');

// Normalize the stored card URL so only valid public Cloudinary HTTPS links are used in emails.
function normalizeCloudinaryImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return '';
  const trimmed = imageUrl.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('https://')) return '';
  if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(trimmed)) return '';
  return trimmed;
}

// Resolve the selected card image from either the wish record or the related GreetingCard document.
async function resolveWishCardImage(wish) {
  const resolvedWish = { ...wish };
  const directImageUrl = normalizeCloudinaryImageUrl(wish.cardImage);
  if (directImageUrl) {
    resolvedWish.cardImage = directImageUrl;
    return resolvedWish;
  }

  const selectedCard = wish.selectedCardId && typeof wish.selectedCardId === 'object'
    ? wish.selectedCardId
    : null;

  if (selectedCard?.imageUrl) {
    resolvedWish.cardImage = normalizeCloudinaryImageUrl(selectedCard.imageUrl);
    return resolvedWish;
  }

  if (wish.selectedCardId) {
    const card = await GreetingCard.findById(wish.selectedCardId).select('imageUrl').lean();
    if (card?.imageUrl) {
      resolvedWish.cardImage = normalizeCloudinaryImageUrl(card.imageUrl);
      resolvedWish.selectedCardId = card;
    }
  }

  return resolvedWish;
}

/**
 * Core dispatch function — sends a wish via the specified method(s)
 * Returns { emailSent, whatsappSent, errors[] }
 */
async function dispatchWish(wish) {
  const result = { emailSent: false, whatsappSent: false, errors: [] };

  const method = wish.deliveryMethod || 'email';

  // ── EMAIL ──────────────────────────────────────────────
  if (method === 'email' || method === 'both') {
    if (!wish.receiverEmail) {
      result.errors.push('Email: no receiver email set');
    } else {
      try {
        console.log('[Scheduler] Scheduled wish:', JSON.stringify({
          id: wish._id,
          receiverEmail: wish.receiverEmail,
          selectedCardId: wish.selectedCardId || null,
          cardImage: wish.cardImage || '',
        }));

        const resolvedWish = await resolveWishCardImage(wish);
        console.log('[Scheduler] Selected card:', JSON.stringify({
          selectedCardId: resolvedWish.selectedCardId?._id || resolvedWish.selectedCardId || null,
          imageUrl: resolvedWish.cardImage || '',
        }));

        await sendWishEmail(resolvedWish);
        result.emailSent = true;
      } catch (err) {
        result.errors.push(`Email error: ${err.message}`);
        console.error(`📧 Email failed for wish ${wish._id}:`, err.message);
      }
    }
  }

  // ── WHATSAPP ───────────────────────────────────────────
  if (method === 'whatsapp' || method === 'both') {
    console.log("Coming soon...");
    if (!wish.receiverWhatsapp) {
      result.errors.push('WhatsApp: no receiver number set');
    } else {
      try {
        await sendWishWhatsApp(wish);
        result.whatsappSent = true;
      } catch (err) {
        result.errors.push(`WhatsApp error: ${err.message}`);
        console.error(`💬 WhatsApp failed for wish ${wish._id}:`, err.message);
      }
    }
  }

  return result;
}

/**
 * Calculate the next repeat date
 */
function calcNextSendDate(wish) {
  if (wish.repeat === 'yearly') {
    const next = new Date(wish.scheduleDate);
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }
  if (wish.repeat === 'daily') {
    const next = new Date(wish.scheduleDate);
    next.setDate(next.getDate() + 1);
    return next;
  }
  return null;
}

/**
 * Main cron job — runs every minute
 * Checks for pending wishes whose scheduleDate has passed
 */
function startScheduler() {
  console.log('⏰ Wish scheduler started — checking every minute');

  cron.schedule('* * * * *', async () => {
    const now = new Date();

    try {
      // Find all pending wishes that are due (scheduleDate ≤ now)
      const dueWishes = await Wish.find({
        status: 'Pending',
        scheduleDate: { $lte: now },
      }).populate('selectedCardId', 'title imageUrl').lean();

      if (dueWishes.length === 0) return;

      console.log(`\n⏰ [${now.toISOString()}] Found ${dueWishes.length} due wish(es)`);

      for (const wish of dueWishes) {
        try {
          // Immediately mark as processing to prevent double-sends
          await Wish.findByIdAndUpdate(wish._id, { status: 'Sent' });

          // Dispatch
          const result = await dispatchWish(wish);

          const allFailed = !result.emailSent && !result.whatsappSent;

          if (allFailed) {
            // Mark as failed
            await Wish.findByIdAndUpdate(wish._id, {
              status: 'Failed',
              failReason: result.errors.join('; '),
            });
            console.log(`❌ Wish ${wish._id} FAILED: ${result.errors.join('; ')}`);
          } else {
            // Success — handle repeat
            const nextDate = calcNextSendDate(wish);
            const update = {
              status: 'Sent',
              sentAt: now,
            };

            if (nextDate) {
              // Create a new wish for the next cycle
              const nextWish = new (require('../models/Wish'))({
                ...wish,
                _id: undefined,
                status: 'Pending',
                scheduleDate: nextDate,
                sentAt: undefined,
                failReason: undefined,
                createdAt: undefined,
                updatedAt: undefined,
              });
              await nextWish.save();
              console.log(`🔄 Repeat wish created for ${nextDate.toISOString()}`);
            }

            await Wish.findByIdAndUpdate(wish._id, update);
            console.log(`✅ Wish ${wish._id} sent | email:${result.emailSent} wa:${result.whatsappSent}`);
          }
        } catch (err) {
          console.error(`🔥 Unexpected error processing wish ${wish._id}:`, err);
          await Wish.findByIdAndUpdate(wish._id, {
            status: 'Failed',
            failReason: err.message,
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('🔥 Scheduler query error:', err.message);
    }
  });
}

module.exports = { startScheduler, dispatchWish };
