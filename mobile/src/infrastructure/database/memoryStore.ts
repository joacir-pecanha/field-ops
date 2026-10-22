import { User, Inspection, ChecklistItem, ChecklistResponse, OutboxOperation } from './types';

// O Store em memória simula o banco de dados
class MemoryStore {
  users: User[] = [];
  inspections: Inspection[] = [];
  checklistItems: ChecklistItem[] = [];
  checklistResponses: ChecklistResponse[] = [];
  outboxOperations: OutboxOperation[] = [];

  clear() {
    this.users = [];
    this.inspections = [];
    this.checklistItems = [];
    this.checklistResponses = [];
    this.outboxOperations = [];
  }
}

export const store = new MemoryStore();
