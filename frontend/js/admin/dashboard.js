// ---------------------------------------------------------------------------
// Wires up sidebar navigation and loads the Overview stats.
// Individual sections (cards.js, categories.js, users.js, wishes.js) each
// expose an init function that runs the first time their section is opened.
// ---------------------------------------------------------------------------

requireAdminAuth();

const navItems = document.querySelectorAll('.nav-item[data-section]');
const sections = document.querySelectorAll('.admin-section');
const loadedSections = new Set();

function showSection(name) {
  sections.forEach((s) => (s.hidden = s.id !== `section-${name}`));
  navItems.forEach((n) => n.classList.toggle('active', n.dataset.section === name));

  if (name === 'overview') loadOverviewStats();

  if (!loadedSections.has(name)) {
    loadedSections.add(name);
    if (name === 'cards') initCardsSection();
    if (name === 'categories') initCategoriesSection();
    if (name === 'users') initUsersSection();
    if (name === 'wishes') initWishesSection();
  }
}

navItems.forEach((btn) => {
  btn.addEventListener('click', () => showSection(btn.dataset.section));
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearAdminSession();
  window.location.href = 'login.html';
});

async function loadOverviewStats() {
  try {
    const { stats, latestUploads } = await adminFetch('/admin/dashboard/stats');

    document.getElementById('statUsers').textContent = stats.totalUsers;
    document.getElementById('statCards').textContent = stats.totalCards;
    document.getElementById('statPremium').textContent = stats.premiumCards;
    document.getElementById('statFree').textContent = stats.freeCards;
    document.getElementById('statWishes').textContent = stats.scheduledWishes;

    const body = document.getElementById('latestUploadsBody');
    if (!latestUploads.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty-state">No cards uploaded yet</td></tr>';
      return;
    }
    body.innerHTML = latestUploads
      .map(
        (card) => `
      <tr>
        <td>${card.imageUrl ? `<img src="${card.imageUrl}" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:6px" />` : '—'}</td>
        <td>${escapeHtml(card.title)}</td>
        <td>${escapeHtml(card.category?.name || '—')}</td>
        <td>${card.isPremium ? 'Premium' : 'Free'}</td>
        <td>${new Date(card.createdAt).toLocaleDateString()}</td>
      </tr>`
      )
      .join('');
    return;

    /* Legacy category-based renderer retained below for reference.
    body.innerHTML = latestUploads
      .map(
        (c) => `
      <tr>
        <td style="font-size:20px">${c.icon || '🎉'}</td>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.slug)}</td>
        <td class="row-actions">
          <button class="btn btn-ghost" onclick='openCategoryModal(${JSON.stringify(c).replace(/'/g, "&apos;")})'>Edit</button>
          <button class="btn btn-danger" data-delete-category="${c._id}">Delete</button>
        </td>
      </tr>`
      )
      .join('');
    */
  } catch (err) {
    showToast(err.message, 'error');
  }
}

loadOverviewStats();
