import type { User } from '../entities/user';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  upsert(user: Pick<User, 'id' | 'email' | 'name'>): Promise<User>;
}
