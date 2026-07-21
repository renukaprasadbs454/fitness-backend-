const contentRepository = require("../repositories/content.repository");
const ApiError = require("../utils/ApiError");
const { parsePagination, buildMeta } = require("../utils/pagination");

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(title) {
  const base = slugify(title) || "post";
  let slug = base;
  let suffix = 1;
  // Small collision-avoidance loop; content volume is low enough that
  // a handful of lookups here is not a performance concern.
  while (await contentRepository.findBySlug(slug)) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

async function create(authorId, data) {
  const slug = await uniqueSlug(data.title);
  const publishedAt = data.status === "PUBLISHED" ? new Date() : null;
  return contentRepository.create({ ...data, slug, authorId, publishedAt });
}

async function update(id, data) {
  const existing = await contentRepository.findById(id);
  if (!existing) throw ApiError.notFound("Content post not found");

  const patch = { ...data };
  if (data.title && data.title !== existing.title) {
    patch.slug = await uniqueSlug(data.title);
  }
  if (data.status === "PUBLISHED" && existing.status !== "PUBLISHED") {
    patch.publishedAt = new Date();
  }
  return contentRepository.update(id, patch);
}

async function remove(id) {
  const existing = await contentRepository.findById(id);
  if (!existing) throw ApiError.notFound("Content post not found");
  await contentRepository.delete(id);
}

async function getPublishedBySlug(slug) {
  const post = await contentRepository.findBySlug(slug);
  if (!post || post.status !== "PUBLISHED") throw ApiError.notFound("Content post not found");
  await contentRepository.incrementViewCount(post.id);
  return post;
}

async function listPublished(query) {
  const { page, limit, skip } = parsePagination(query);
  const filters = { type: query.type, categoryId: query.categoryId, search: query.search };
  const [items, total] = await Promise.all([
    contentRepository.listPublished({ skip, take: limit, ...filters }),
    contentRepository.countPublished(filters)
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

async function listAll(query) {
  const { page, limit, skip } = parsePagination(query);
  const filters = {
    type: query.type,
    status: query.status,
    categoryId: query.categoryId,
    authorId: query.authorId,
    search: query.search
  };
  const [items, total] = await Promise.all([
    contentRepository.listAll({ skip, take: limit, ...filters }),
    contentRepository.countAll(filters)
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

async function getById(id) {
  const post = await contentRepository.findById(id);
  if (!post) throw ApiError.notFound("Content post not found");
  return post;
}

// ── Categories ─────────────────────────────────────────
async function listCategories() {
  return contentRepository.listCategories();
}

async function createCategory({ name }) {
  const slug = slugify(name);
  return contentRepository.createCategory({ name, slug });
}

async function deleteCategory(id) {
  const existing = await contentRepository.findCategoryById(id);
  if (!existing) throw ApiError.notFound("Category not found");
  await contentRepository.deleteCategory(id);
}

module.exports = {
  create,
  update,
  remove,
  getPublishedBySlug,
  listPublished,
  listAll,
  getById,
  listCategories,
  createCategory,
  deleteCategory
};
