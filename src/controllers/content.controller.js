const contentService = require("../services/content.service");
const mediaService = require("../services/media.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

// ── Public/authenticated reads ────────────────────────────

const listPublished = asyncHandler(async (req, res) => {
  const { items, meta } = await contentService.listPublished(req.query);
  return ApiResponse.success(res, httpStatus.OK, "Content retrieved", items, meta);
});

const getBySlug = asyncHandler(async (req, res) => {
  const post = await contentService.getPublishedBySlug(req.params.slug);
  return ApiResponse.success(res, httpStatus.OK, "Content retrieved", post);
});

const listCategories = asyncHandler(async (req, res) => {
  const categories = await contentService.listCategories();
  return ApiResponse.success(res, httpStatus.OK, "Categories retrieved", categories);
});

// ── Admin/coach authoring ──────────────────────────────────

const listAll = asyncHandler(async (req, res) => {
  const { items, meta } = await contentService.listAll(req.query);
  return ApiResponse.success(res, httpStatus.OK, "Content retrieved", items, meta);
});

const getById = asyncHandler(async (req, res) => {
  const post = await contentService.getById(req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Content retrieved", post);
});

const create = asyncHandler(async (req, res) => {
  const post = await contentService.create(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Content created", post);
});

const update = asyncHandler(async (req, res) => {
  const post = await contentService.update(req.params.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Content updated", post);
});

const remove = asyncHandler(async (req, res) => {
  await contentService.remove(req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Content deleted", null);
});

const uploadCoverImage = asyncHandler(async (req, res) => {
  const media = await mediaService.uploadImage(req.user.id, req.file, "CONTENT_IMAGE");
  return ApiResponse.success(res, httpStatus.CREATED, "Cover image uploaded", media);
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await contentService.createCategory(req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Category created", category);
});

const deleteCategory = asyncHandler(async (req, res) => {
  await contentService.deleteCategory(req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Category deleted", null);
});

module.exports = {
  listPublished,
  getBySlug,
  listCategories,
  listAll,
  getById,
  create,
  update,
  remove,
  uploadCoverImage,
  createCategory,
  deleteCategory
};
