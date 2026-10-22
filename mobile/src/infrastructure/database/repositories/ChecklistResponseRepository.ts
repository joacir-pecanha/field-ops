import { BaseRepository } from './BaseRepository';
import { ChecklistResponse } from '../types';

export class ChecklistResponseRepository extends BaseRepository<ChecklistResponse> {
  protected storeKey: 'checklistResponses' = 'checklistResponses';

  async findByItemId(itemId: string): Promise<ChecklistResponse | null> {
    const response = this.table.find(i => i.item_id === itemId);
    return response ? { ...response } : null;
  }
}
