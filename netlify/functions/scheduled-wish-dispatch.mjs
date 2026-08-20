// netlify/functions/scheduled-wish-dispatch.mjs
// Triggers the existing /api/scheduler/run endpoint (backend/routes/schedulerRoutes.js)
// on a schedule. The backend previously relied on an in-process node-cron job
// (backend/services/scheduler.js) to send due wishes, but that only works with a
// long-running server — it never runs inside a Netlify Function. The endpoint was
// already built to be triggered externally (guarded by CRON_SECRET via
// backend/middleware/cronAuth.js), so this just supplies that external trigger.
export default async (req, context) => {
  const secret = Netlify.env.get('CRON_SECRET');
  if (!secret) {
    console.warn('[scheduled-wish-dispatch] CRON_SECRET is not set — skipping this run.');
    return;
  }

  const siteUrl = context.site.url || Netlify.env.get('URL');
  const res = await fetch(`${siteUrl}/api/scheduler/run`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  if (!res.ok) {
    console.error(`[scheduled-wish-dispatch] scheduler run failed with status ${res.status}`);
  }
};

export const config = {
  schedule: '*/5 * * * *',
};
