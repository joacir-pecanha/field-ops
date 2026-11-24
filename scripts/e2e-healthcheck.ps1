[CmdletBinding()]
param(
    [string]$ApiUrl = "http://localhost:8080",
    [string]$WebUrl = "http://localhost:4200",
    [string]$PostgresContainer = "fieldops-postgres",
    [string]$DbName = $(if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "fieldops" }),
    [string]$DbUser = $(if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }),
    [string]$DemoPassword = $(if ($env:FIELDOPS_DEMO_PASSWORD) { $env:FIELDOPS_DEMO_PASSWORD } else { "FieldOps@123" }),
    [switch]$ResetSeed,
    [switch]$SkipWebCheck
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$SeedSqlPath = Join-Path $RepoRoot "backend\src\main\resources\db\seed\R__demo_seed_data.sql"

function Write-Step($Label, $Status = "INFO") {
    $Color = switch ($Status) {
        "OK"   { "Green" }
        "WARN" { "Yellow" }
        "FAIL" { "Red" }
        default { "Cyan" }
    }
    Write-Host "[$Status] $Label" -ForegroundColor $Color
}

function Invoke-ApiJson {
    param(
        [string]$Method,
        [string]$Uri,
        [string]$Token = "",
        [object]$Body = $null
    )
    $Headers = @{ "Accept" = "application/json" }
    if ($Token) {
        $Headers["Authorization"] = "Bearer $Token"
    }
    $Params = @{
        Method      = $Method
        Uri         = $Uri
        Headers     = $Headers
        TimeoutSec  = 15
    }
    if ($null -ne $Body) {
        $Params["ContentType"] = "application/json; charset=utf-8"
        $Params["Body"] = ($Body | ConvertTo-Json -Depth 10)
    }
    return Invoke-RestMethod @Params
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " FieldOps MVP — E2E Healthcheck & Seed Validator" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Reset opcional de Seed no PostgreSQL Docker
if ($ResetSeed) {
    if (-not (Test-Path $SeedSqlPath)) {
        Write-Step "Arquivo de seed não encontrado: $SeedSqlPath" "FAIL"
        exit 1
    }
    Write-Step "Reaplicando seed idempotente ($SeedSqlPath) no container $PostgresContainer..." "INFO"
    $SqlContent = Get-Content -Path $SeedSqlPath -Raw -Encoding UTF8
    $SqlContent | docker exec -i $PostgresContainer psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName
    if ($LASTEXITCODE -ne 0) {
        Write-Step "Falha ao reaplicar R__demo_seed_data.sql no container $PostgresContainer" "FAIL"
        exit 1
    }
    Write-Step "Seed idempotente reaplicado com sucesso." "OK"
}

# 2. Verificação opcional do PostgreSQL Docker
try {
    $PgRunning = docker ps --filter "name=^/${PostgresContainer}$" --format "{{.Status}}" 2>$null
    if ($PgRunning) {
        docker exec $PostgresContainer pg_isready -U $DbUser -d $DbName *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Step "PostgreSQL Docker ($PostgresContainer) saudável ($PgRunning)" "OK"
        } else {
            Write-Step "Container $PostgresContainer encontrado, mas pg_isready falhou." "WARN"
        }
    } else {
        Write-Step "Container $PostgresContainer não está em execução local (verifique se está usando AWS RDS ou perfil H2)." "WARN"
    }
} catch {
    Write-Step "Docker CLI indisponível para checagem local do container; prosseguindo com checagem HTTP da API." "WARN"
}

# 3. Actuator Health e OpenAPI
try {
    $Health = Invoke-ApiJson -Method "GET" -Uri "$ApiUrl/actuator/health"
    if ($Health.status -eq "UP") {
        Write-Step "Backend Actuator Health UP ($ApiUrl/actuator/health)" "OK"
    } else {
        Write-Step "Backend Actuator Health retornou status: $($Health.status)" "FAIL"
        exit 1
    }
} catch {
    Write-Step "Falha ao conectar na API em $ApiUrl/actuator/health: $($_.Exception.Message)" "FAIL"
    exit 1
}

try {
    $OpenApi = Invoke-ApiJson -Method "GET" -Uri "$ApiUrl/v3/api-docs"
    if ($OpenApi.openapi) {
        Write-Step "Contrato OpenAPI acessível ($ApiUrl/v3/api-docs - OpenAPI $($OpenApi.openapi))" "OK"
    }
} catch {
    Write-Step "Falha ao consultar /v3/api-docs: $($_.Exception.Message)" "FAIL"
    exit 1
}

# 4. Login dos 3 perfis obrigatórios (RF-01)
$Profiles = @(
    @{ Email = "admin@fieldops.com"; ExpectedRole = "ADMIN" },
    @{ Email = "supervisor@fieldops.com"; ExpectedRole = "SUPERVISOR" },
    @{ Email = "tecnico@fieldops.com"; ExpectedRole = "TECHNICIAN" }
)
$Tokens = @{}

foreach ($Profile in $Profiles) {
    try {
        $LoginRes = Invoke-ApiJson -Method "POST" -Uri "$ApiUrl/api/v1/auth/login" -Body @{
            email    = $Profile.Email
            password = $DemoPassword
        }
        if ($LoginRes.user.role -ne $Profile.ExpectedRole) {
            Write-Step "Perfil inesperado para $($Profile.Email): $($LoginRes.user.role)" "FAIL"
            exit 1
        }
        $Tokens[$Profile.ExpectedRole] = $LoginRes.accessToken
        Write-Step "Login autenticado: $($Profile.Email) [$($Profile.ExpectedRole)]" "OK"
    } catch {
        Write-Step "Falha de login para $($Profile.Email): $($_.Exception.Message)" "FAIL"
        exit 1
    }
}

$SupervisorToken = $Tokens["SUPERVISOR"]
$TechnicianToken = $Tokens["TECHNICIAN"]

# 5. Validar Cliente (1), Locais (2), Equipamentos (3), Template Publicado (1) e Inspeção Atribuída (1)
$ClientsPage = Invoke-ApiJson -Method "GET" -Uri "$ApiUrl/api/v1/clients?search=CLI-ALFA" -Token $SupervisorToken
$AlfaClient = $ClientsPage.content | Where-Object { $_.code -eq "CLI-ALFA" } | Select-Object -First 1
if (-not $AlfaClient) {
    Write-Step "Cliente de demonstração CLI-ALFA não encontrado." "FAIL"
    exit 1
}
$SitesPage = Invoke-ApiJson -Method "GET" -Uri "$ApiUrl/api/v1/clients/$($AlfaClient.id)/sites" -Token $SupervisorToken
if ($SitesPage.totalElements -lt 2) {
    Write-Step "Esperado ao menos 2 locais para CLI-ALFA, encontrado $($SitesPage.totalElements)." "FAIL"
    exit 1
}
Write-Step "Cliente CLI-ALFA validado com $($SitesPage.totalElements) locais distintos." "OK"

$ExpectedQrs = @("QR-FIELDOPS-GD001", "QR-FIELDOPS-CP002", "QR-FIELDOPS-TR003")
foreach ($Qr in $ExpectedQrs) {
    $Eq = Invoke-ApiJson -Method "GET" -Uri "$ApiUrl/api/v1/equipments/qr/$Qr" -Token $SupervisorToken
    if (-not $Eq.id) {
        Write-Step "Equipamento com QR Code $Qr não encontrado." "FAIL"
        exit 1
    }
}
Write-Step "3 Equipamentos com QR Codes únicos validados ($($ExpectedQrs -join ', '))." "OK"

$TemplatesPage = Invoke-ApiJson -Method "GET" -Uri "$ApiUrl/api/v1/inspection-templates?search=TPL-GER-01" -Token $SupervisorToken
$DemoTemplate = $TemplatesPage.content | Where-Object { $_.code -eq "TPL-GER-01" -and $_.status -eq "PUBLISHED" } | Select-Object -First 1
if (-not $DemoTemplate) {
    Write-Step "Modelo publicado TPL-GER-01 não encontrado." "FAIL"
    exit 1
}
Write-Step "Modelo publicado TPL-GER-01 validado (versão $($DemoTemplate.currentVersion))." "OK"

$AssignedList = Invoke-ApiJson -Method "GET" -Uri "$ApiUrl/api/v1/inspections/assigned" -Token $TechnicianToken
$ReadyInspection = $AssignedList | Where-Object { $_.status -eq "ATRIBUÍDA" } | Select-Object -First 1
if (-not $ReadyInspection) {
    Write-Step "Nenhuma inspeção no estado ATRIBUÍDA disponível para tecnico@fieldops.com." "FAIL"
    exit 1
}
Write-Step "Inspeção atribuída pronta para download: $($ReadyInspection.title) ($($ReadyInspection.id))." "OK"

# 6. Validar QR Codes PNG locais
$QrDir = Join-Path $RepoRoot "mobile\assets\demo-qr-codes"
foreach ($Qr in $ExpectedQrs) {
    $PngFile = Join-Path $QrDir "$Qr.png"
    if (-not (Test-Path $PngFile) -or (Get-Item $PngFile).Length -le 0) {
        Write-Step "Arquivo PNG ausente ou vazio: $PngFile" "FAIL"
        exit 1
    }
}
Write-Step "Arquivos PNG dos 3 QR Codes verificados em mobile/assets/demo-qr-codes/." "OK"

# 7. Verificação opcional da Interface Web
if (-not $SkipWebCheck) {
    try {
        $WebResp = Invoke-WebRequest -Uri $WebUrl -Method "GET" -TimeoutSec 5 -UseBasicParsing
        if ($WebResp.StatusCode -eq 200) {
            Write-Step "Interface Web acessível em $WebUrl (HTTP 200)" "OK"
        }
    } catch {
        Write-Step "Interface Web não detectada em $WebUrl (inicie com 'npm --prefix web start')." "WARN"
    }
}

Write-Host "=================================================================" -ForegroundColor Green
Write-Step "Ambiente FieldOps validado e pronto para demonstração E2E!" "OK"
Write-Host "=================================================================" -ForegroundColor Green
