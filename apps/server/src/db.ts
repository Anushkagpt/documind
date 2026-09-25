import { PrismaClient } from '@prisma/client';
import { config } from './config';

export const prisma = config.demoMode ? (null as unknown as PrismaClient) : new PrismaClient();
