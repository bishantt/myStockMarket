import { PrismaClient } from "@prisma/client";

/**
 * db.ts — the one Prisma client the whole app shares.
 *
 * The singleton exists to survive Next.js dev-mode hot reloading. Every hot reload re-evaluates
 * modules, and a fresh `new PrismaClient()` each time would open a new pool of database
 * connections and quickly exhaust Supabase's free-tier limit. Stashing the client on
 * globalThis means one client persists across reloads. In production the module evaluates once,
 * so the guard simply never triggers.
 *
 * Everything reads through this. The app never constructs its own PrismaClient.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Quiet in normal use; surfaces real errors and slow-query warnings when developing.
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
