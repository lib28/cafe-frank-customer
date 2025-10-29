// src/api/menu.js
import { api } from './base';

const normalizeItem = (item, cat) => ({
  id: item.id,
  name: item.name,
  price: item.price,
  description: item.description ?? item.desc ?? '',
  imageUrl: item.imageUrl ?? item.image ?? '',
  categoryId: cat?.id,
  categoryName: cat?.name,
});

export const fetchMenu = async () => {
  const data = await api.get('/menu');

  // Already a flat array?
  if (Array.isArray(data)) {
    return data.map(i => normalizeItem(i));
  }

  // items[] at top-level?
  if (Array.isArray(data?.items)) {
    return data.items.map(i => normalizeItem(i));
  }

  // categories[] -> items[]
  if (Array.isArray(data?.categories)) {
    return data.categories.flatMap(cat =>
      (cat.items || []).map(i => normalizeItem(i, cat))
    );
  }

  return [];
};

// If you need raw categories elsewhere
export const fetchCategories = async () => {
  const data = await api.get('/menu');
  return Array.isArray(data?.categories) ? data.categories : [];
};

// Client-side search over flattened list
export const searchMenu = async (q) => {
  const list = await fetchMenu();
  const s = String(q || '').toLowerCase();
  if (!s) return list;
  return list.filter(i =>
    i.name?.toLowerCase().includes(s) ||
    i.description?.toLowerCase().includes(s) ||
    i.categoryName?.toLowerCase().includes(s)
  );
};

// Item lookup (no /menu/:id needed)
export const fetchItem = async (id) => {
  const list = await fetchMenu();
  return list.find(i => String(i.id) === String(id));
};
