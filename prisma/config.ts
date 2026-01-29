// Prisma 7 requires prisma.config.ts for datasource URL
// This file is used by Prisma Migrate
export default {
  url: process.env.DATABASE_URL || "",
};
