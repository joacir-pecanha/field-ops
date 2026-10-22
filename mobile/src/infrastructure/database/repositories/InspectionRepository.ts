import { BaseRepository } from './BaseRepository';
import { Inspection } from '../types';

export class InspectionRepository extends BaseRepository<Inspection> {
  protected storeKey: 'inspections' = 'inspections';

  async findByStatus(status: string): Promise<Inspection[]> {
    return this.table.filter(i => i.status === status);
  }
}
