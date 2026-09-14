const userRepository = require("../repositories/user.repository");
const ApiError = require("../utils/ApiError");

async function getMe(userId) {
  const user = await userRepository.findByIdWithProfile(userId);
  if (!user) throw ApiError.notFound("User not found");
  // eslint-disable-next-line no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
}

async function updateProfile(userId, data) {
  const { fullName, username, ...profileFields } = data;

  if (username) {
    const existing = await userRepository.findByUsername(username);
    if (existing && existing.id !== userId) {
      throw ApiError.conflict("Username is already taken");
    }
  }

  if (fullName || username) {
    const prisma = require("../database/prismaClient");
    await prisma.user.update({
      where: { id: userId },
      data: { ...(fullName ? { fullName } : {}), ...(username ? { username } : {}) }
    });
  }

  if (Object.keys(profileFields).length === 0) {
    return userRepository.findProfileByUserId(userId);
  }

  return userRepository.upsertProfile(userId, profileFields);
}


module.exports = { getMe, updateProfile };
