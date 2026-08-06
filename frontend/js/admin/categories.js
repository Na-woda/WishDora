// ---------------------------------------------------------------------------
// Category management: list + create/edit modal + delete (with duplicate
// prevention handled server-side)
// ---------------------------------------------------------------------------

function initCategoriesSection() {
  document.getElementById('addCategoryBtn').addEventListener('click', () => openCategoryModal());
  document.getElementById('categoryModalCancel').addEventListener('click', closeCategoryModal);
  document.getElementById('categoryForm').addEventListener('submit', submitCategoryForm);
  document.getElementById('categoryImage').addEventListener('change', previewCategoryImage);
  loadCategories();
}

async function loadCategories() {
  const body = document.getElementById('categoriesBody');
  body.innerHTML = '<tr><td colspan="3" class="empty-state">Loading…</td></tr>';

  try {
    const { categories } = await adminFetch('/categories');

    if (!categories.length) {
      body.innerHTML = '<tr><td colspan="3" class="empty-state">No categories yet</td></tr>';
      return;
    }

    body.innerHTML = categories
      .map(
        (c) => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.slug)}</td>
        <td class="row-actions">
          <button class="btn btn-ghost" onclick='openCategoryModal(${JSON.stringify(c).replace(/'/g, "&apos;")})'>Edit</button>
          <button class="btn btn-danger" data-delete-category="${c._id}">Delete</button>
        </td>
      </tr>`
      )
      .join('');

    body.querySelectorAll('[data-delete-category]').forEach((btn) => {
      btn.addEventListener('click', () => deleteCategory(btn.dataset.deleteCategory));
    });

    // Keep the card section's category dropdowns fresh if it's already loaded.
    if (typeof loadCardCategoryOptions === 'function') loadCardCategoryOptions();
  } catch (err) {
    body.innerHTML = '<tr><td colspan="3" class="empty-state">Failed to load categories</td></tr>';
    showToast(err.message, 'error');
  }
}

function openCategoryModal(category = null) {
  document.getElementById('categoryForm').reset();
  document.getElementById('categoryId').value = category ? category._id : '';
  document.getElementById('categoryName').value = category ? category.name : '';
  document.getElementById('categoryDescription').value = category ? (category.description || '') : '';
  document.getElementById('categoryColor').value = category ? (category.color || '') : '';
  document.getElementById('removeCategoryImage').checked = false;
  document.getElementById('categoryImagePreview').innerHTML = category?.imageUrl
    ? `<img src="${category.imageUrl}" alt="" />`
    : 'No image selected';
  document.getElementById('categoryModalTitle').textContent = category ? 'Edit Category' : 'New Category';
  document.getElementById('categoryModalBackdrop').hidden = false;
}

function closeCategoryModal() {
  document.getElementById('categoryModalBackdrop').hidden = true;
}

async function submitCategoryForm(e) {
  e.preventDefault();
  const id = document.getElementById('categoryId').value;
  const name = document.getElementById('categoryName').value.trim();
  const categoryData = new FormData();
  categoryData.append('name', name);
  categoryData.append('description', document.getElementById('categoryDescription').value.trim());
  categoryData.append('color', document.getElementById('categoryColor').value.trim());
  categoryData.append('removeImage', document.getElementById('removeCategoryImage').checked);
  const image = document.getElementById('categoryImage').files[0];
  if (image) categoryData.append('image', image);

  try {
    if (id) {
      await adminFetch(`/admin/categories/${id}`, {
        method: 'PUT',
        body: categoryData,
      });
      showToast('Category updated');
    } else {
      await adminFetch('/admin/categories', {
        method: 'POST',
        body: categoryData,
      });
      showToast('Category created');
    }
    closeCategoryModal();
    loadCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function previewCategoryImage(e) {
  const preview = document.getElementById('categoryImagePreview');
  const file = e.target.files[0];
  if (file) document.getElementById('removeCategoryImage').checked = false;
  preview.innerHTML = file
    ? `<img src="${URL.createObjectURL(file)}" alt="Selected category image" />`
    : 'No image selected';
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  try {
    await adminFetch(`/admin/categories/${id}`, { method: 'DELETE' });
    showToast('Category deleted');
    loadCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
