import { BaseRepository } from './BaseRepository';
import { OutboxOperation, OutboxStatus } from '../types';

export class OutboxRepository extends BaseRepository<OutboxOperation> {
  protected storeKey: 'outboxOperations' = 'outboxOperations';

  async findPendingOperations(): Promise<OutboxOperation[]> {
    return this.table
      .filter(o => o.status === 'PENDING' || o.status === 'ERROR')
      .sort((a, b) => {
        if (!a.created_at || !b.created_at) return 0;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }

  async updateStatus(id: string, status: OutboxStatus, errorMessage?: string): Promise<void> {
    const item = this.table.find(o => o.id === id);
    if (item) {
      item.status = status;
      item.error_message = errorMessage;
      item.updated_at = new Date().toISOString();
    }
  }

  async incrementRetries(id: string): Promise<void> {
    const item = this.table.find(o => o.id === id);
    if (item) {
      item.retries = (item.retries || 0) + 1;
      item.updated_at = new Date().toISOString();
    }
  }
}
