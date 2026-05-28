import type { IUserRepository } from '../contracts';
import type { User } from '../entities/user';
import { ResourceNotFoundError } from '@/shared/errors';

export class GetUserService {
  constructor(private readonly users: IUserRepository) {}

  async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new ResourceNotFoundError('User', userId);
    return user;
  }
}
