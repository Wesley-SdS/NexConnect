import { PrismaClient } from '@prisma/client';

export async function createTestPrismaClient(): Promise<PrismaClient> {
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  });
  await prisma.$connect();
  return prisma;
}

export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;

  for (const { tablename } of tables) {
    if (tablename === '_prisma_migrations') continue;
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
  }
}
