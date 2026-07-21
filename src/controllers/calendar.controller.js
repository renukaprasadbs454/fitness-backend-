const calendarService = require("../services/calendar.service");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const httpStatus = require("../constants/httpStatus");

const upcoming = asyncHandler(async (req, res) => {
  const items = await calendarService.upcoming(req.user.id);
  return ApiResponse.success(res, httpStatus.OK, "Upcoming calendar items retrieved", items);
});

module.exports = { upcoming };
