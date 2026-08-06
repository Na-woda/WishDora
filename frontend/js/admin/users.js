// ---------------------------------------------------------------------------
// Registered users — read-only view for the admin
// ---------------------------------------------------------------------------

let usersState = { page: 1, search: '' };

function initUsersSection() {
  let debounce;
  document.getElementById('userSearch').addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      usersState.search = e.target.value.trim();
      usersState.page = 1;
      loadUsers();
    }, 350);
  });
  loadUsers();
}

async function loadUsers() {
  const body = document.getElementById('usersBody');
  body.innerHTML = '<tr><td colspan="4" class="empty-state">Loading…</td></tr>';

  const params = new URLSearchParams({ page: usersState.page, limit: 15 });
  if (usersState.search) params.set('search', usersState.search);

  try {
    const { users, pagination } = await adminFetch(`/admin/users?${params.toString()}`);

    if (!users.length) {
      body.innerHTML = '<tr><td colspan="4" class="empty-state">No users found</td></tr>';
      document.getElementById('usersPagination').innerHTML = '';
      return;
    }

    body.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${u.isPremium ? '<span class="badge badge-premium">Premium</span>' : '<span class="badge badge-free">Free</span>'}</td>
        <td>${new Date(u.createdAt).toLocaleDateString()}</td>
      </tr>`
      )
      .join('');

    renderPagination('usersPagination', pagination, (page) => {
      usersState.page = page;
      loadUsers();
    });
  } catch (err) {
    body.innerHTML = '<tr><td colspan="4" class="empty-state">Failed to load users</td></tr>';
    showToast(err.message, 'error');
  }
}
