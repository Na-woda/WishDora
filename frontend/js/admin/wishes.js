// ---------------------------------------------------------------------------
// Scheduled wishes — read-only admin view
// ---------------------------------------------------------------------------

let wishesState = { page: 1 };

function initWishesSection() {
  loadWishes();
}

async function loadWishes() {
  const body = document.getElementById('wishesBody');
  body.innerHTML = '<tr><td colspan="5" class="empty-state">Loading…</td></tr>';

  const params = new URLSearchParams({ page: wishesState.page, limit: 15 });

  try {
    const { wishes, pagination } = await adminFetch(`/admin/wishes?${params.toString()}`);

    if (!wishes.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty-state">No scheduled wishes yet</td></tr>';
      document.getElementById('wishesPagination').innerHTML = '';
      return;
    }

    body.innerHTML = wishes
      .map(
        (w) => `
      <tr>
        <td>${escapeHtml(w.senderName)} <span style="color:var(--text-muted)">(${escapeHtml(w.userId?.email || w.senderEmail || '')})</span></td>
        <td>${escapeHtml(w.receiverName)}</td>
        <td>${escapeHtml(w.selectedCardId?.title || '—')}</td>
        <td>${new Date(w.scheduleDate).toLocaleString()}</td>
        <td>${statusBadge(w.status)}</td>
      </tr>`
      )
      .join('');

    renderPagination('wishesPagination', pagination, (page) => {
      wishesState.page = page;
      loadWishes();
    });
  } catch (err) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">Failed to load scheduled wishes</td></tr>';
    showToast(err.message, 'error');
  }
}

function statusBadge(status) {
  const colors = { Pending: 'badge-free', Sent: 'badge-premium', Failed: 'badge-free', Draft: 'badge-free' };
  return `<span class="badge ${colors[status] || 'badge-free'}">${escapeHtml(status)}</span>`;
}
