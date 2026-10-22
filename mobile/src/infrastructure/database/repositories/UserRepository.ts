import { BaseRepository } from './BaseRepository';
import { User } from '../types';

export class UserRepository extends BaseRepository<User> {
  protected storeKey: 'users' = 'users';

  async findByEmail(email: string): Promise<User | null> {
    const user = this.table.find(u => u.email === email);
    return user ? { ...user } : null;
  }
}
