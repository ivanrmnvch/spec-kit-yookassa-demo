import { PrismaClient } from "../../prisma/generated/prisma/client";

/**
 * User repository
 * Provides data access methods for User entity
 */
export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Check if a user exists by ID
   * @param userId - User UUID
   * @returns true if user exists, false otherwise
   */
  async existsById(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    return user !== null;
  }
}

