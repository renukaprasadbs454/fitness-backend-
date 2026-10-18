const packageService = require("../services/package.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const list = asyncHandler(async (req, res) => {
  const items = await packageService.listActive();
  return ApiResponse.success(res, httpStatus.OK, "Packages retrieved", items);
});

const listAll = asyncHandler(async (req, res) => {
  const items = await packageService.listAll();
  return ApiResponse.success(res, httpStatus.OK, "Packages retrieved", items);
});

const checkout = asyncHandler(async (req, res) => {
  const result = await packageService.checkout(req.user.id, req.params.id, req.body.method);
  return ApiResponse.success(res, httpStatus.CREATED, "Order placed", result);
});

const create = asyncHandler(async (req, res) => {
  const pkg = await packageService.create(req.user.id, req.body);
  return ApiResponse.success(res, httpStatus.CREATED, "Package created", pkg);
});

const update = asyncHandler(async (req, res) => {
  const pkg = await packageService.update(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, httpStatus.OK, "Package updated", pkg);
});

const remove = asyncHandler(async (req, res) => {
  await packageService.remove(req.user.id, req.params.id);
  return ApiResponse.success(res, httpStatus.OK, "Package deleted");
});

module.exports = { list, listAll, checkout, create, update, remove };
