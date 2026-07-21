const { z } = require("zod");

const CONTENT_TYPES = ["BLOG", "VIDEO", "WORKOUT_TIP", "NUTRITION_TIP"];
const CONTENT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];

const listPublished = {
  query: z.object({
    type: z.enum(CONTENT_TYPES).optional(),
    categoryId: z.string().uuid().optional(),
    search: z.string().max(200).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
};

const listAll = {
  query: z.object({
    type: z.enum(CONTENT_TYPES).optional(),
    status: z.enum(CONTENT_STATUSES).optional(),
    categoryId: z.string().uuid().optional(),
    authorId: z.string().uuid().optional(),
    search: z.string().max(200).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
};

const slugParam = { params: z.object({ slug: z.string().min(1) }) };
const idParam = { params: z.object({ id: z.string().uuid() }) };

const create = {
  body: z.object({
    type: z.enum(CONTENT_TYPES),
    title: z.string().min(3).max(200),
    summary: z.string().max(500).optional(),
    body: z.string().max(50000).optional(),
    videoUrl: z.string().url().optional(),
    coverImageUrl: z.string().url().optional(),
    status: z.enum(CONTENT_STATUSES).optional(),
    categoryId: z.string().uuid().optional()
  })
};

const update = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    type: z.enum(CONTENT_TYPES).optional(),
    title: z.string().min(3).max(200).optional(),
    summary: z.string().max(500).optional(),
    body: z.string().max(50000).optional(),
    videoUrl: z.string().url().optional(),
    coverImageUrl: z.string().url().optional(),
    status: z.enum(CONTENT_STATUSES).optional(),
    categoryId: z.string().uuid().optional()
  })
};

const createCategory = {
  body: z.object({ name: z.string().min(2).max(100) })
};

module.exports = { listPublished, listAll, slugParam, idParam, create, update, createCategory };
