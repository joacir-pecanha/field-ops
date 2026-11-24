#!/bin/sh
set -e

echo "[fieldops-postgres-init] Iniciando criação de schema (V1..V6) e carga do seed de demonstração..."

for migration in /opt/fieldops/db/migration/V*.sql; do
  if [ -f "$migration" ]; then
    echo "[fieldops-postgres-init] Executando migração: $(basename "$migration")"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$migration"
  fi
done

SEED_FILE="/opt/fieldops/db/seed/R__demo_seed_data.sql"
if [ -f "$SEED_FILE" ]; then
  echo "[fieldops-postgres-init] Executando seed idempotente: $(basename "$SEED_FILE")"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$SEED_FILE"
else
  echo "[fieldops-postgres-init] AVISO: arquivo $SEED_FILE não encontrado."
fi

echo "[fieldops-postgres-init] Banco PostgreSQL inicializado com sucesso e pronto para uso."
