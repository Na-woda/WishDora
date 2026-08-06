// ---------------------------------------------------------------------------
// Greeting card management: list (with search/filter/pagination) + modal CRUD
// ---------------------------------------------------------------------------

let cardsState = { page: 1, search: '', category: '', isPremium: '' };
let cardCategoriesCache = [];
let cardsById = new Map();
let editingCardId = null;

async function initCardsSection() {
  await loadCardCategoryOptions();
  bindCardToolbar();
  bindCardModal();
  await loadCards();
}

function bindCardToolbar() {
  let debounce;
  document.getElementById('cardSearch').addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      cardsState.search = e.target.value.trim();
      cardsState.page = 1;
      loadCards();
    }, 350);
  });
  document.getElementById('cardCategoryFilter').addEventListener('change', (e) => {
    cardsState.category = e.target.value;
    cardsState.page = 1;
    loadCards();
  });
  document.getElementById('cardPremiumFilter').addEventListener('change', (e) => {
    cardsState.isPremium = e.target.value;
    cardsState.page = 1;
    loadCards();
  });
  document.getElementById('addCardBtn').addEventListener('click', () => openCardModal());
}

async function loadCardCategoryOptions() {
  try {
    const { categories } = await adminFetch('/categories');
    cardCategoriesCache = categories;

    const filterSelect = document.getElementById('cardCategoryFilter');
    const modalSelect = document.getElementById('cardCategory');
    const opts = categories.map((c) => `<option value="${c._id}">${escapeHtml(c.name)}</option>`).join('');

    filterSelect.innerHTML = '<option value="">All categories</option>' + opts;
    modalSelect.innerHTML = opts;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadCards() {
  const body = document.getElementById('cardsBody');
  body.innerHTML = '<tr><td colspan="6" class="empty-state">Loading…</td></tr>';

  const params = new URLSearchParams({ page: cardsState.page, limit: 10 });
  if (cardsState.search) params.set('search', cardsState.search);
  if (cardsState.category) params.set('category', cardsState.category);
  if (cardsState.isPremium) params.set('isPremium', cardsState.isPremium);

  try {
    const { cards, pagination } = await adminFetch(`/cards?${params.toString()}`);
    cardsById = new Map(cards.map((card) => [card._id, card]));

    if (!cards.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-state">No cards found</td></tr>';
      document.getElementById('cardsPagination').innerHTML = '';
      return;
    }

    body.innerHTML = cards
      .map(
        (c) => `
      <tr>
        <td><img class="row-thumb" src="${c.imageUrl}" alt="" /></td>
        <td>${escapeHtml(c.title)}</td>
        <td>${escapeHtml(c.category?.name || '—')}</td>
        <td>${c.isPremium ? '<span class="badge badge-premium">Premium</span>' : '<span class="badge badge-free">Free</span>'}</td>
        <td>${new Date(c.createdAt).toLocaleDateString()}</td>
        <td class="row-actions">
          <button class="btn btn-ghost" data-edit-card="${c._id}">Edit</button>
          <button class="btn btn-danger" data-delete-card="${c._id}">Delete</button>
        </td>
      </tr>`
      )
      .join('');

    body.querySelectorAll('[data-edit-card]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = cardsById.get(btn.dataset.editCard);
        if (card) openCardModal(card);
      });
    });

    body.querySelectorAll('[data-delete-card]').forEach((btn) => {
      btn.addEventListener('click', () => deleteCard(btn.dataset.deleteCard));
    });

    renderPagination('cardsPagination', pagination, (page) => {
      cardsState.page = page;
      loadCards();
    });
  } catch (err) {
    body.innerHTML = '<tr><td colspan="6" class="empty-state">Failed to load cards</td></tr>';
    showToast(err.message, 'error');
  }
}

function renderPagination(containerId, pagination, onChange) {
  const el = document.getElementById(containerId);
  if (pagination.pages <= 1) {
    el.innerHTML = '';
    return;
  }
  let html = '';
  for (let p = 1; p <= pagination.pages; p++) {
    html += `<button class="${p === pagination.page ? 'active' : ''}" data-page="${p}">${p}</button>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => onChange(Number(btn.dataset.page)));
  });
}

// ---------- Modal ----------

function bindCardModal() {
  document.getElementById('cardModalCancel').addEventListener('click', closeCardModal);
  document.getElementById('cardImage').addEventListener('change', previewCardImage);
  document.getElementById('cardForm').addEventListener('submit', submitCardForm);
}

function openCardModal(card = null) {
  const form = document.getElementById('cardForm');
  const submitBtn = document.getElementById('cardModalSubmit');
  form.reset();
  editingCardId = null;
  document.getElementById('cardImagePreview').innerHTML = 'No image selected';
  document.getElementById('cardImage').value = '';

  if (card) {
    editingCardId = card._id;
    document.getElementById('cardModalTitle').textContent = 'Edit Greeting Card';
    submitBtn.textContent = 'Update Card';
    document.getElementById('cardId').value = card._id;
    document.getElementById('cardTitle').value = card.title;
    document.getElementById('cardCategory').value = card.category?._id || card.category;
    document.getElementById('cardIsPremium').checked = !!card.isPremium;
    document.getElementById('cardImagePreview').innerHTML = `<img src="${card.imageUrl}" alt="" />`;
  } else {
    document.getElementById('cardModalTitle').textContent = 'Upload Greeting Card';
    submitBtn.textContent = 'Save Card';
    document.getElementById('cardId').value = '';
  }

  document.getElementById('cardModalBackdrop').hidden = false;
}

function closeCardModal() {
  const form = document.getElementById('cardForm');
  form.reset();
  editingCardId = null;
  document.getElementById('cardImage').value = '';
  document.getElementById('cardImagePreview').innerHTML = 'No image selected';
  document.getElementById('cardModalBackdrop').hidden = true;
}

function previewCardImage(e) {
  const file = e.target.files[0];
  const preview = document.getElementById('cardImagePreview');
  if (!file) {
    preview.innerHTML = 'No image selected';
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => (preview.innerHTML = `<img src="${ev.target.result}" alt="" />`);
  reader.readAsDataURL(file);
}

async function submitCardForm(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('cardModalSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';

  const id = editingCardId || document.getElementById('cardId').value;
  const fd = new FormData();
  fd.append('title', document.getElementById('cardTitle').value.trim());
  fd.append('category', document.getElementById('cardCategory').value);
  fd.append('isPremium', document.getElementById('cardIsPremium').checked);

  const file = document.getElementById('cardImage').files[0];
  if (file) fd.append('image', file);

  try {
    if (id) {
      await adminFetch(`/admin/cards/${id}`, { method: 'PUT', body: fd });
      showToast('Card updated');
    } else {
      if (!file) throw new Error('Please select an image for the card');
      await adminFetch('/admin/cards', { method: 'POST', body: fd });
      showToast('Card uploaded');
    }
    closeCardModal();
    loadCards();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Card';
  }
}

async function deleteCard(id) {
  if (!confirm('Delete this greeting card? This cannot be undone.')) return;
  try {
    await adminFetch(`/admin/cards/${id}`, { method: 'DELETE' });
    showToast('Card deleted');
    loadCards();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
