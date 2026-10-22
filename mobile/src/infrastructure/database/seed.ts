import { store } from './memoryStore';

export const seedDatabase = async () => {
  store.clear();

  store.users.push({
    id: 'user-1',
    name: 'Joacir Peçanha',
    email: 'joacir@example.com',
    role: 'INSPECTOR',
  });

  store.inspections.push({
    id: 'insp-1',
    remote_id: 'remote-1',
    client: 'Acme Corp',
    site: 'Fábrica Principal',
    equipment: 'Gerador A1',
    status: 'ASSIGNED',
    priority: 'HIGH',
    due_date: new Date(Date.now() + 86400000).toISOString(),
  });
  
  store.inspections.push({
    id: 'insp-2',
    remote_id: 'remote-2',
    client: 'Tech Indústria',
    site: 'Galpão 3',
    equipment: 'Esteira B',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    due_date: new Date().toISOString(),
  });

  store.inspections.push({
    id: 'insp-3',
    client: 'AgroBusiness',
    site: 'Fazenda Sul',
    equipment: 'Trator',
    status: 'DRAFT',
    priority: 'LOW',
    due_date: new Date(Date.now() - 86400000).toISOString(),
  });

  store.inspections.push({
    id: 'insp-4',
    remote_id: 'remote-4',
    client: 'Construtora XYZ',
    site: 'Obra Centro',
    equipment: 'Guindaste',
    status: 'SUBMITTED',
    priority: 'HIGH',
    due_date: new Date(Date.now() - 172800000).toISOString(),
  });

  store.outboxOperations.push({
    id: 'op-1',
    entity_type: 'INSPECTION',
    global_id: 'insp-3',
    operation_type: 'CREATE',
    payload: '{"client":"AgroBusiness","status":"DRAFT"}',
    status: 'PENDING',
    retries: 0,
  });

  console.log('In-memory database seeded successfully!');
  return Promise.resolve();
};
