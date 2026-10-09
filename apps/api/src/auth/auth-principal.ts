import type { Role } from '@hr/types';
import type { Request } from 'express';

export interface AuthPrincipal {
  userId: string;
  employeeId: string;
  role: Role;
}

export type AuthenticatedRequest = Request & { user?: AuthPrincipal };
