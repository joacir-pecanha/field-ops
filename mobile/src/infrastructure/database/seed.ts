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
    template_id: 'tmpl-geradores',
    template_version: 1,
    client_name: 'Acme Corp',
    site_name: 'Fábrica Principal',
    equipment_name: 'Gerador A1',
    client: 'Acme Corp',
    site: 'Fábrica Principal',
    equipment: 'Gerador A1',
    status: 'ATRIBUÍDA',
    priority: 'ALTA',
    due_date: new Date(Date.now() + 86400000).toISOString(),
    sync_status: 'SINCRONIZADO',
  });
  
  store.inspections.push({
    id: 'insp-2',
    remote_id: 'remote-2',
    template_id: 'tmpl-esteiras',
    template_version: 1,
    client_name: 'Tech Indústria',
    site_name: 'Galpão 3',
    equipment_name: 'Esteira B',
    client: 'Tech Indústria',
    site: 'Galpão 3',
    equipment: 'Esteira B',
    status: 'EM_ANDAMENTO',
    priority: 'MEDIA',
    due_date: new Date().toISOString(),
    sync_status: 'SINCRONIZADO',
  });

  store.inspections.push({
    id: 'insp-3',
    template_id: 'tmpl-agricola',
    template_version: 1,
    client_name: 'AgroBusiness',
    site_name: 'Fazenda Sul',
    equipment_name: 'Trator',
    client: 'AgroBusiness',
    site: 'Fazenda Sul',
    equipment: 'Trator',
    status: 'RASCUNHO',
    priority: 'BAIXA',
    due_date: new Date(Date.now() - 86400000).toISOString(),
    sync_status: 'PENDENTE',
  });

  store.inspections.push({
    id: 'insp-4',
    remote_id: 'remote-4',
    template_id: 'tmpl-guindastes',
    template_version: 1,
    client_name: 'Construtora XYZ',
    site_name: 'Obra Centro',
    equipment_name: 'Guindaste',
    client: 'Construtora XYZ',
    site: 'Obra Centro',
    equipment: 'Guindaste',
    status: 'ENVIADA',
    priority: 'ALTA',
    due_date: new Date(Date.now() - 172800000).toISOString(),
    sync_status: 'SINCRONIZADO',
  });

  store.outboxOperations.push({
    id: 'op-1',
    entity_type: 'INSPECTION',
    global_id: 'insp-3',
    operation_type: 'START_INSPECTION',
    payload: JSON.stringify({ id: 'insp-3', status: 'RASCUNHO' }),
    status: 'PENDING',
    retries: 0,
  });

  console.log('In-memory database seeded successfully!');
  return Promise.resolve();
};
