import { getDatabase } from './db';
import { runMigrations } from './migrations';
import { inspectionRepository } from './repositories/inspectionRepository';
import { outboxRepository } from './repositories/outboxRepository';
import { store } from './memoryStore';

export const seedDatabase = async (): Promise<void> => {
  // 1. Garante que o banco SQLite esteja aberto e com migrações aplicadas
  const db = await getDatabase();
  await runMigrations(db);

  // 2. Limpa dados em memória
  store.clear();

  // 3. Usuário de teste
  const user = {
    id: 'user-1',
    name: 'Joacir Peçanha',
    email: 'joacir@example.com',
    role: 'INSPECTOR',
  };
  store.users.push(user);
  await db.runAsync(
    `INSERT OR REPLACE INTO users (id, name, email, role, created_at, updated_at) 
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    [user.id, user.name, user.email, user.role]
  );

  // 4. Inspeções de teste
  const inspections = [
    {
      id: 'insp-1',
      remote_id: 'remote-1',
      template_id: 'tmpl-geradores',
      template_version: 1,
      client_name: 'Acme Corp',
      site_name: 'Fábrica Principal',
      equipment_name: 'Gerador A1',
      status: 'ATRIBUÍDA',
      priority: 'ALTA',
      due_date: new Date(Date.now() + 86400000).toISOString(),
      sync_status: 'SINCRONIZADO' as const,
    },
    {
      id: 'insp-2',
      remote_id: 'remote-2',
      template_id: 'tmpl-esteiras',
      template_version: 1,
      client_name: 'Tech Indústria',
      site_name: 'Galpão 3',
      equipment_name: 'Esteira B',
      status: 'EM_ANDAMENTO',
      priority: 'MEDIA',
      due_date: new Date().toISOString(),
      sync_status: 'SINCRONIZADO' as const,
    },
    {
      id: 'insp-3',
      remote_id: null,
      template_id: 'tmpl-agricola',
      template_version: 1,
      client_name: 'AgroBusiness',
      site_name: 'Fazenda Sul',
      equipment_name: 'Trator',
      status: 'RASCUNHO',
      priority: 'BAIXA',
      due_date: new Date(Date.now() - 86400000).toISOString(),
      sync_status: 'PENDENTE' as const,
    },
    {
      id: 'insp-4',
      remote_id: 'remote-4',
      template_id: 'tmpl-guindastes',
      template_version: 1,
      client_name: 'Construtora XYZ',
      site_name: 'Obra Centro',
      equipment_name: 'Guindaste',
      status: 'ENVIADA',
      priority: 'ALTA',
      due_date: new Date(Date.now() - 172800000).toISOString(),
      sync_status: 'SINCRONIZADO' as const,
    },
  ];

  for (const insp of inspections) {
    store.inspections.push({
      ...insp,
      client: insp.client_name,
      site: insp.site_name,
      equipment: insp.equipment_name,
    });
    await inspectionRepository.upsert({
      ...insp,
      client: insp.client_name,
      site: insp.site_name,
      equipment: insp.equipment_name,
    });
  }

  // 5. Operação outbox de teste
  const op = {
    id: 'op-1',
    entity_type: 'INSPECTION' as const,
    global_id: 'insp-3',
    operation_type: 'START_INSPECTION' as const,
    payload: JSON.stringify({ id: 'insp-3', status: 'RASCUNHO' }),
    status: 'PENDING' as const,
    retries: 0,
  };

  store.outboxOperations.push(op);
  await db.runAsync(
    `INSERT OR REPLACE INTO outbox_operations (
      id, entity_type, global_id, operation_type, payload, status, retries, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    [op.id, op.entity_type, op.global_id, op.operation_type, op.payload, op.status, op.retries]
  );

  console.log('Database (SQLite and memory store) seeded successfully!');
};
