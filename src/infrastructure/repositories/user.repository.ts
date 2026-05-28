import type { IUserRepository } from '@/core/users/contracts';
import type { User } from '@/core/users/entities/user';
import { BaseRepository } from './base.repository';

export class UserRepository extends BaseRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) this.handleError(error, 'findById');
    return data ? this.map(data) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) this.handleError(error, 'findByEmail');
    return data ? this.map(data) : null;
  }

  async upsert(user: Pick<User, 'id' | 'email' | 'name'>): Promise<User> {
    const { data, error } = await this.db
      .from('users')
      .upsert({ id: user.id, email: user.email, name: user.name })
      .select()
      .single();

    if (error || !data) this.handleError(error, 'upsert');
    return this.map(data!);
  }

  private map(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      email: row.email as string,
      name: (row.name as string) ?? null,
      createdAt: new Date(row.created_at as string),
    };
  }
}
