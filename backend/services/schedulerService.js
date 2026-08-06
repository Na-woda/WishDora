const mongoose = require('mongoose');
const Wish = require('../models/Wish');
const GreetingCard = require('../models/GreetingCard');
const { sendWishEmail } = require('./emailService');

function normalizeCloudinaryImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return '';
  const trimmed = imageUrl.trim();
  if (!trimmed || !trimmed.startsWith('https://')) return '';
  return /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(trimmed) ? trimmed : '';
}

async function resolveWishCardImage(wish) {
  const wishObject = typeof wish.toObject === 'function' ? wish.toObject() : wish;
  const resolvedWish = { ...wishObject };
  const directImageUrl = normalizeCloudinaryImageUrl(wishObject.cardImage);
  if (directImageUrl) {
    resolvedWish.cardImage = directImageUrl;
    return resolvedWish;
  }

  const selectedCard = wishObject.selectedCardId && typeof wishObject.selectedCardId === 'object'
    ? wishObject.selectedCardId
    : null;

  if (selectedCard?.imageUrl) {
    resolvedWish.cardImage = normalizeCloudinaryImageUrl(selectedCard.imageUrl);
    return resolvedWish;
  }

  if (wishObject.selectedCardId) {
    const card = await GreetingCard.findById(wishObject.selectedCardId).select('imageUrl').lean();
    if (card?.imageUrl) {
      resolvedWish.cardImage = normalizeCloudinaryImageUrl(card.imageUrl);
      resolvedWish.selectedCardId = card;
    }
  }

  return resolvedWish;
}

async function dispatchWish(wish) {
  const result = { emailSent: false, whatsappSent: false, errors: [] };
  const method = wish.deliveryMethod || 'email';

  if (method === 'email' || method === 'both') {
    if (!wish.receiverEmail) {
      result.errors.push('Email: no receiver email set');
    } else {
      try {
        const resolvedWish = await resolveWishCardImage(wish);
        await sendWishEmail(resolvedWish);
        result.emailSent = true;
      } catch (err) {
        result.errors.push(`Email error: ${err.message}`);
        console.error(`[Scheduler] Email failed for wish ${wish._id}:`, err.message);
      }
    }
  }

  if (method === 'whatsapp' || method === 'both') {
    result.errors.push('WhatsApp delivery is not enabled');
  }

  return result;
}

function calcNextSendDate(wish) {
  const next = new Date(wish.scheduleDate);
  if (wish.repeat === 'yearly') {
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }
  if (wish.repeat === 'daily') {
    next.setDate(next.getDate() + 1);
    return next;
  }
  return null;
}

async function createRepeatWish(wish) {
  const nextDate = calcNextSendDate(wish);
  if (!nextDate) return;

  const repeatWish = wish.toObject ? wish.toObject() : { ...wish };
  delete repeatWish._id;
  delete repeatWish.__v;
  delete repeatWish.createdAt;
  delete repeatWish.updatedAt;
  delete repeatWish.sentAt;
  delete repeatWish.failReason;

  repeatWish.status = 'Pending';
  repeatWish.scheduleDate = nextDate;

  await Wish.create(repeatWish);
  console.log(`[Scheduler] Repeat wish created for ${nextDate.toISOString()}`);
}

async function markFailed(wishId, reason) {
  const updated = await Wish.findOneAndUpdate(
    { _id: wishId, status: 'Processing' },
    { $set: { status: 'Failed', failReason: reason } },
    { new: true },
  );

  if (!updated) {
    throw new Error(`Could not mark wish ${wishId} as Failed`);
  }
}

async function runDueWishes() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB is not connected');
  }

  const summary = { processed: 0, sent: 0, failed: 0 };

  while (true) {
    const wish = await Wish.findOneAndUpdate(
      { status: 'Pending', scheduleDate: { $lte: new Date() } },
      { $set: { status: 'Processing' } },
      { new: true },
    );

    if (!wish) break;
    summary.processed += 1;

    try {
      const result = await dispatchWish(wish);
      if (!result.emailSent && !result.whatsappSent) {
        await markFailed(wish._id, result.errors.join('; ') || 'No delivery method succeeded');
        summary.failed += 1;
        console.error(`[Scheduler] Wish ${wish._id} failed: ${result.errors.join('; ')}`);
        continue;
      }

      const sentWish = await Wish.findOneAndUpdate(
        { _id: wish._id, status: 'Processing' },
        { $set: { status: 'Sent', sentAt: new Date() }, $unset: { failReason: 1 } },
        { new: true },
      );

      if (!sentWish) throw new Error(`Could not mark wish ${wish._id} as Sent`);

      summary.sent += 1;
      console.log(`[Scheduler] Wish ${wish._id} sent | email:${result.emailSent} wa:${result.whatsappSent}`);

      try {
        await createRepeatWish(wish);
      } catch (repeatError) {
        // The original email was sent. Do not retry it just because repeat creation failed.
        console.error(`[Scheduler] Could not create repeat for wish ${wish._id}:`, repeatError.message);
      }
    } catch (err) {
      console.error(`[Scheduler] Unexpected error processing wish ${wish._id}:`, err);
      try {
        await markFailed(wish._id, err.message);
      } catch (updateError) {
        console.error(`[Scheduler] Could not record failure for wish ${wish._id}:`, updateError.message);
      }
      summary.failed += 1;
    }
  }

  console.log(`[Scheduler] Run complete | processed:${summary.processed} sent:${summary.sent} failed:${summary.failed}`);
  return summary;
}

module.exports = { dispatchWish, runDueWishes };
