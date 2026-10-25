const packageRepository = require("../repositories/package.repository");
const adminRepository = require("../repositories/admin.repository");
const ApiError = require("../utils/ApiError");

function toDto(pkg) {
  const price = Number(pkg.price);
  const originalPrice = Number(pkg.originalPrice);
  return {
    id: pkg.id,
    name: pkg.name,
    tagline: pkg.tagline,
    durationMonths: pkg.durationMonths,
    price,
    originalPrice,
    pricePerMonth: Math.round(price / pkg.durationMonths),
    discountPercent: originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
    currency: pkg.currency,
    features: pkg.features,
    badge: pkg.badge,
    isActive: pkg.isActive,
    sortOrder: pkg.sortOrder
  };
}

async function listActive() {
  return (await packageRepository.listActive()).map(toDto);
}

async function listAll() {
  return (await packageRepository.listAll()).map(toDto);
}

/**
 * Records a purchase attempt. No payment gateway is wired up yet, so the
 * Payment row stays PENDING — marking it SUCCESS here would put money that
 * never moved into the admin revenue totals. The amount always comes from the
 * database, never from the client.
 */
async function checkout(userId, packageId, method) {
  const pkg = await packageRepository.findById(packageId);
  if (!pkg || !pkg.isActive) throw ApiError.notFound("Package not found");

  // Tapping "Buy" again shouldn't stack up duplicate pending payments: reuse the open one.
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const open = await packageRepository.findRecentPendingPayment(userId, pkg.id, since);
  const payment = open && open.method === method ? open : await packageRepository.createPayment({
    userId,
    amount: pkg.price,
    currency: pkg.currency,
    status: "PENDING",
    method,
    purpose: "SUBSCRIPTION",
    referenceId: pkg.id
  });

  return {
    paymentId: payment.id,
    status: payment.status,
    amount: Number(payment.amount),
    currency: payment.currency,
    method: payment.method,
    package: toDto(pkg)
  };
}

async function create(adminId, data) {
  const pkg = await packageRepository.create(data);
  await adminRepository.createAuditLog(adminId, "CREATE_PACKAGE", "PACKAGE", pkg.id, data);
  return toDto(pkg);
}

async function update(adminId, id, data) {
  const existing = await packageRepository.findById(id);
  if (!existing) throw ApiError.notFound("Package not found");
  const pkg = await packageRepository.update(id, data);
  await adminRepository.createAuditLog(adminId, "UPDATE_PACKAGE", "PACKAGE", id, data);
  return toDto(pkg);
}

async function remove(adminId, id) {
  const existing = await packageRepository.findById(id);
  if (!existing) throw ApiError.notFound("Package not found");
  await packageRepository.delete(id);
  await adminRepository.createAuditLog(adminId, "DELETE_PACKAGE", "PACKAGE", id, { name: existing.name });
}

module.exports = { listActive, listAll, checkout, create, update, remove };
