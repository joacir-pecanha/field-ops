import { store } from '../memoryStore';

export abstract class BaseRepository<T extends { id: string }> {
  protected abstract storeKey: keyof typeof store;

  protected get table(): T[] {
    // Acessa o array correspondente na store em memória usando type assertion
    // pois TypeScript não tem certeza do tipo exato que está sendo acessado via storeKey
    const t = store[this.storeKey];
    if (typeof t !== 'function') {
        return store[this.storeKey] as any as T[];
    }
    return [];
  }

  async findAll(): Promise<T[]> {
    return [...this.table];
  }

  async findById(id: string): Promise<T | null> {
    const item = this.table.find((i) => i.id === id);
    return item ? { ...item } : null;
  }

  async create(data: Omit<T, 'created_at' | 'updated_at'>): Promise<void> {
    const newItem = {
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as T;
    
    this.table.push(newItem);
  }

  async update(id: string, data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    const index = this.table.findIndex((i) => i.id === id);
    if (index !== -1) {
      this.table[index] = {
        ...this.table[index],
        ...data,
        updated_at: new Date().toISOString(),
      };
    }
  }

  async delete(id: string): Promise<void> {
    const index = this.table.findIndex((i) => i.id === id);
    if (index !== -1) {
      this.table.splice(index, 1);
    }
  }
}
