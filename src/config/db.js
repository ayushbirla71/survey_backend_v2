import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"],
    transactionOptions: {
      maxWait: 10000, // wait up to 10s to start transaction
      timeout: 20000, // allow 20 seconds inside transaction
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;

// import { PrismaClient } from "@prisma/client";
// const prisma = new PrismaClient();
// export default prisma;
