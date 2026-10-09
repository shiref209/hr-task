import { Prisma } from '@prisma/client';

// Backstop for the race between a service's uniqueness check and the write.
export async function translateUniqueViolation<T>(
  write: () => Promise<T>,
  toDomainError: () => Error,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw toDomainError();
    throw error;
  }
}
