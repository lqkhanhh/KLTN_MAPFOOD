import { UserRole } from '../../database/entities';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: UserRole;
}
