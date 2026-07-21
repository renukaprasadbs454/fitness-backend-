const prisma = require("../database/prismaClient");

const listInclude = {
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, fullName: true, role: true } }
};

const contentRepository = {
  create: (data) => prisma.contentPost.create({ data, include: listInclude }),

  update: (id, data) => prisma.contentPost.update({ where: { id }, data, include: listInclude }),

  delete: (id) => prisma.contentPost.delete({ where: { id } }),

  findById: (id) => prisma.contentPost.findUnique({ where: { id }, include: listInclude }),

  findBySlug: (slug) => prisma.contentPost.findUnique({ where: { slug }, include: listInclude }),

  incrementViewCount: (id) =>
    prisma.contentPost.update({ where: { id }, data: { viewCount: { increment: 1 } } }),

  // Public/user-facing listing — published only.
  listPublished: ({ skip, take, type, categoryId, search }) =>
    prisma.contentPost.findMany({
      where: {
        status: "PUBLISHED",
        type: Array.isArray(type) ? { in: type } : type || undefined,
        categoryId: categoryId || undefined,
        title: search ? { contains: search, mode: "insensitive" } : undefined
      },
      include: listInclude,
      orderBy: { publishedAt: "desc" },
      skip,
      take
    }),

  countPublished: ({ type, categoryId, search }) =>
    prisma.contentPost.count({
      where: {
        status: "PUBLISHED",
        type: Array.isArray(type) ? { in: type } : type || undefined,
        categoryId: categoryId || undefined,
        title: search ? { contains: search, mode: "insensitive" } : undefined
      }
    }),

  // Admin/coach listing — all statuses, optionally scoped to one author.
  listAll: ({ skip, take, type, status, categoryId, authorId, search }) =>
    prisma.contentPost.findMany({
      where: {
        type: type || undefined,
        status: status || undefined,
        categoryId: categoryId || undefined,
        authorId: authorId || undefined,
        title: search ? { contains: search, mode: "insensitive" } : undefined
      },
      include: listInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),

  countAll: ({ type, status, categoryId, authorId, search }) =>
    prisma.contentPost.count({
      where: {
        type: type || undefined,
        status: status || undefined,
        categoryId: categoryId || undefined,
        authorId: authorId || undefined,
        title: search ? { contains: search, mode: "insensitive" } : undefined
      }
    }),

  // ── Categories ─────────────────────────────────────────
  listCategories: () => prisma.contentCategory.findMany({ orderBy: { name: "asc" } }),
  createCategory: (data) => prisma.contentCategory.create({ data }),
  findCategoryById: (id) => prisma.contentCategory.findUnique({ where: { id } }),
  deleteCategory: (id) => prisma.contentCategory.delete({ where: { id } })
};

module.exports = contentRepository;
