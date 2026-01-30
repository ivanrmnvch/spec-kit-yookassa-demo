/**
 * Interface for user repository operations
 * Enables dependency injection of user repository through Dependency Inversion Principle
 */
export interface IUserRepository {
  /**
   * Check if a user exists by ID
   * @param userId - User UUID
   * @returns true if user exists, false otherwise
   */
  existsById(userId: string): Promise<boolean>;
}

