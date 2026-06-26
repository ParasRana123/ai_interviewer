import { PrismaClient } from "../generated/prisma/client.ts";
import { withAccelerate } from '@prisma/extension-accelerate'
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
})

export const prisma = new PrismaClient({
    adapter,
}).$extends(withAccelerate())