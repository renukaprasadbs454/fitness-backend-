class ApiResponse {
  static success(res, statusCode, message, data = null, meta = undefined) {
    const body = { success: true, message, data };
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
  }
}

module.exports = ApiResponse;
