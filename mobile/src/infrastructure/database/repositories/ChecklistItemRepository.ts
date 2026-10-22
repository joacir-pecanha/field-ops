import { BaseRepository } from './BaseRepository';
import { ChecklistItem } from '../types';

export class ChecklistItemRepository extends BaseRepository<ChecklistItem> {
  protected storeKey: 'checklistItems' = 'checklistItems';

  async findByInspectionId(inspectionId: string): Promise<ChecklistItem[]> {
    return this.table.filter(i => i.inspection_id === inspectionId);
  }
}
