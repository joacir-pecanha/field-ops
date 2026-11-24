#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
WEB_URL="${WEB_URL:-http://localhost:4200}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-fieldops-postgres}"
DB_NAME="${POSTGRES_DB:-fieldops}"
DB_USER="${POSTGRES_USER:-postgres}"
DEMO_PASSWORD="${FIELDOPS_DEMO_PASSWORD:-FieldOps@123}"
RESET_SEED=false
SKIP_WEB=false

for arg in "$@"; do
  case "$arg" in
    --reset-seed) RESET_SEED=true ;;
    --skip-web) SKIP_WEB=true ;;
    *) echo "Argumento desconhecido: $arg" >&2; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SEED_SQL="$REPO_ROOT/backend/src/main/resources/db/seed/R__demo_seed_data.sql"

log_ok()   { echo "[OK] $1"; }
log_warn() { echo "[WARN] $1"; }
log_fail() { echo "[FAIL] $1" >&2; exit 1; }

if ! command -v curl >/dev/null 2>&1; then
  log_fail "curl é obrigatório para executar o healthcheck."
fi
if ! command -v node >/dev/null 2>&1; then
  log_fail "node é obrigatório para parsear respostas JSON."
fi

if [ "$RESET_SEED" = true ]; then
  [ -f "$SEED_SQL" ] || log_fail "Seed não encontrado em $SEED_SQL"
  echo "[INFO] Reaplicando R__demo_seed_data.sql..."
  if [ -n "${DB_HOST:-}" ]; then
    PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -v ON_ERROR_STOP=1 \
      -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -f "$SEED_SQL"
  else
    docker exec -i "$POSTGRES_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$SEED_SQL"
  fi
  log_ok "Seed idempotente reaplicado com sucesso."
fi

if command -v docker >/dev/null 2>&1 && docker ps --filter "name=^/${POSTGRES_CONTAINER}$" --format '{{.Status}}' | grep -q .; then
  docker exec "$POSTGRES_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 \
    && log_ok "PostgreSQL Docker ($POSTGRES_CONTAINER) saudável." \
    || log_warn "Container $POSTGRES_CONTAINER em execução, mas pg_isready falhou."
else
  log_warn "Container $POSTGRES_CONTAINER não detectado localmente (usando RDS ou H2)."
fi

HEALTH_JSON="$(curl -fsS "$API_URL/actuator/health")" || log_fail "API inacessível em $API_URL/actuator/health"
echo "$HEALTH_JSON" | grep -q '"UP"' || log_fail "Actuator health não retornou UP: $HEALTH_JSON"
log_ok "Backend Actuator Health UP ($API_URL/actuator/health)"

curl -fsS "$API_URL/v3/api-docs" >/dev/null || log_fail "OpenAPI inacessível em $API_URL/v3/api-docs"
log_ok "Contrato OpenAPI acessível ($API_URL/v3/api-docs)"

login_and_get_token() {
  local email="$1"
  local expected_role="$2"
  local res
  res="$(curl -fsS -X POST "$API_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$DEMO_PASSWORD\"}")"
  node -e "
    const data = JSON.parse(process.argv[1]);
    if (!data.accessToken || data.user?.role !== process.argv[2]) process.exit(1);
    process.stdout.write(data.accessToken);
  " "$res" "$expected_role"
}

ADMIN_TOKEN="$(login_and_get_token "admin@fieldops.com" "ADMIN")" || log_fail "Falha de login ADMIN"
log_ok "Login autenticado: admin@fieldops.com [ADMIN]"
SUPERVISOR_TOKEN="$(login_and_get_token "supervisor@fieldops.com" "SUPERVISOR")" || log_fail "Falha de login SUPERVISOR"
log_ok "Login autenticado: supervisor@fieldops.com [SUPERVISOR]"
TECH_TOKEN="$(login_and_get_token "tecnico@fieldops.com" "TECHNICIAN")" || log_fail "Falha de login TECHNICIAN"
log_ok "Login autenticado: tecnico@fieldops.com [TECHNICIAN]"

CLIENTS_JSON="$(curl -fsS -H "Authorization: Bearer $SUPERVISOR_TOKEN" "$API_URL/api/v1/clients?search=CLI-ALFA")"
CLIENT_ID="$(node -e "
  const page = JSON.parse(process.argv[1]);
  const c = (page.content || []).find(x => x.code === 'CLI-ALFA');
  if (!c) process.exit(1);
  process.stdout.write(c.id);
" "$CLIENTS_JSON")" || log_fail "Cliente CLI-ALFA não encontrado"

SITES_JSON="$(curl -fsS -H "Authorization: Bearer $SUPERVISOR_TOKEN" "$API_URL/api/v1/clients/$CLIENT_ID/sites")"
node -e "
  const page = JSON.parse(process.argv[1]);
  if ((page.totalElements || 0) < 2) process.exit(1);
" "$SITES_JSON" || log_fail "CLI-ALFA não possui 2 locais distintos"
log_ok "Cliente CLI-ALFA validado com >= 2 locais distintos."

for qr in QR-FIELDOPS-GD001 QR-FIELDOPS-CP002 QR-FIELDOPS-TR003; do
  curl -fsS -H "Authorization: Bearer $SUPERVISOR_TOKEN" "$API_URL/api/v1/equipments/qr/$qr" >/dev/null \
    || log_fail "Equipamento com QR $qr não encontrado"
  [ -s "$REPO_ROOT/mobile/assets/demo-qr-codes/${qr}.png" ] \
    || log_fail "PNG ausente: mobile/assets/demo-qr-codes/${qr}.png"
done
log_ok "3 equipamentos, QR Codes únicos e arquivos PNG validados."

TPL_JSON="$(curl -fsS -H "Authorization: Bearer $SUPERVISOR_TOKEN" "$API_URL/api/v1/inspection-templates?search=TPL-GER-01")"
node -e "
  const page = JSON.parse(process.argv[1]);
  const t = (page.content || []).find(x => x.code === 'TPL-GER-01' && x.status === 'PUBLISHED');
  if (!t) process.exit(1);
" "$TPL_JSON" || log_fail "Modelo publicado TPL-GER-01 não encontrado"
log_ok "Modelo publicado TPL-GER-01 validado."

ASSIGNED_JSON="$(curl -fsS -H "Authorization: Bearer $TECH_TOKEN" "$API_URL/api/v1/inspections/assigned")"
node -e "
  const list = JSON.parse(process.argv[1]);
  const ready = (list || []).find(x => x.status === 'ATRIBUÍDA');
  if (!ready) process.exit(1);
" "$ASSIGNED_JSON" || log_fail "Nenhuma inspeção ATRIBUÍDA disponível para tecnico@fieldops.com"
log_ok "Inspeção atribuída pronta para download validada."

if [ "$SKIP_WEB" = false ]; then
  if curl -fsS "$WEB_URL" >/dev/null 2>&1; then
    log_ok "Interface Web acessível em $WEB_URL"
  else
    log_warn "Interface Web não detectada em $WEB_URL (inicie com 'npm --prefix web start')."
  fi
fi

log_ok "Ambiente FieldOps validado e pronto para demonstração E2E!"
