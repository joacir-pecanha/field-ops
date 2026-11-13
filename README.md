# FieldOps — Plataforma de Inspeções Técnicas em Campo

Plataforma integrada **Offline-First** para planejamento, execução em campo, sincronização resiliente (Outbox Pattern), revisão e auditoria de inspeções técnicas.

---

## Estrutura do Repositório

```text
field-ops/
├── backend/             # API REST (Java 26 + Spring Boot 4.1.2 + PostgreSQL + Flyway)
├── web/                 # Interface Administrativa Web (Angular 20 + TypeScript)
├── mobile/              # Aplicativo Mobile Offline-First (Expo v57 + React Native + SQLite)
├── docs/                # Documentação funcional, regras de negócio, arquitetura e modelo de dados
└── base-conhecimento/   # Governança Spec-Driven Development (SDD), specs e tasks
```

---

## Pré-requisitos

### Para o Backend (`backend/`)
- **Java JDK 26** instalado e configurado no `PATH` (`java -version`).
- **PostgreSQL** em execução (local ou via Docker).
- *(Não é necessário instalar o Maven globalmente; o projeto inclui o Maven Wrapper `mvnw` / `mvnw.cmd`).*

### Para a Interface Administrativa Web (`web/`)
- **Node.js** (v20.19+ / v22.12+ / v24+ recomendado) e **npm**.

### Para o Mobile (`mobile/`)
- **Node.js** (v20+ recomendado) e **npm**.
- Aplicativo **Expo Go** instalado no dispositivo móvel (Android ou iOS) ou Android Studio / Xcode para emulador.

---

## 1. Como Rodar o Backend (`field-ops-backend`)

1. Acesse a pasta do backend:
   ```bash
   cd backend
   ```

2. Configure as variáveis de conexão com o PostgreSQL (via variáveis de ambiente ou em `src/main/resources/application.properties`):
   ```properties
   spring.datasource.url=jdbc:postgresql://localhost:5432/fieldops
   spring.datasource.username=postgres
   spring.datasource.password=postgres
   ```

3. Execute a aplicação utilizando o Maven Wrapper:
   - **Windows (PowerShell / CMD):**
     ```powershell
     .\mvnw.cmd spring-boot:run
     ```
   - **Linux / macOS:**
     ```bash
     ./mvnw spring-boot:run
     ```

A API ficará disponível por padrão em `http://localhost:8080`.

---

## 2. Como Rodar a Interface Administrativa Web (`web`)

1. Acesse a pasta da interface web e instale as dependências:
   ```bash
   cd web
   npm install
   ```

2. Verifique a URL da API em [`web/src/environments/environment.ts`](web/src/environments/environment.ts) (padrão: `http://localhost:8080`).

3. Inicie o servidor de desenvolvimento do Angular:
   ```bash
   npm start
   ```

A interface administrativa ficará disponível por padrão em `http://localhost:4200`.

---

## 3. Como Rodar o Aplicativo Mobile (`mobile`)

1. Acesse a pasta do aplicativo mobile e instale as dependências:
   ```bash
   cd mobile
   npm install
   ```

2. Inicie o servidor de desenvolvimento do Expo:
   ```bash
   npm run start
   ```

---

## 4. Como Rodar e Conectar o Mobile e o Backend em Outro Dispositivo

Quando o aplicativo mobile roda em um **celular físico** ou em **outro computador/dispositivo**, o endereço `http://localhost:8080` **não** aponta para a máquina onde o backend está rodando (pois `localhost` refere-se ao próprio dispositivo).

Siga o passo a passo abaixo para conectar ambos na mesma rede ou em outra máquina:

### Passo 1: Descobrir o IP da máquina que executa o Backend

Na máquina onde o `field-ops-backend` está rodando, verifique o endereço IPv4 da sua placa de rede local (Wi-Fi/Ethernet):

- **Windows (PowerShell / CMD):**
  ```powershell
  ipconfig
  ```
  *(Procure por `Endereço IPv4`, por exemplo: `192.168.1.100`)*

- **Linux / macOS:**
  ```bash
  ip a || ifconfig
  ```

### Passo 2: Permitir que o Backend aceite conexões externas na rede local

1. Certifique-se de que o Spring Boot está escutando em todas as interfaces de rede (`0.0.0.0`). Em `backend/src/main/resources/application.properties` (ou via variável de ambiente), garanta:
   ```properties
   server.address=0.0.0.0
   server.port=8080
   ```
2. **Firewall:** Certifique-se de que a porta `8080` (TCP) está liberada no Firewall do sistema operacional para conexões na rede privada/local.
3. **Teste rápido:** No navegador do celular ou do outro dispositivo, acesse `http://<IP_DO_BACKEND>:8080/actuator/health` (ex: `http://192.168.1.100:8080/actuator/health`) para confirmar que o dispositivo enxerga o backend.

### Passo 3: Configurar a URL da API no Mobile (`EXPO_PUBLIC_API_URL`)

O cliente HTTP do aplicativo ([`apiClient.ts`](mobile/src/infrastructure/http/apiClient.ts)) lê automaticamente a variável `EXPO_PUBLIC_API_URL`.

Crie ou edite o arquivo `.env` dentro da pasta `mobile/` (`mobile/.env`) com o endereço correspondente ao seu cenário:

```env
# Exemplo para celular físico ou outro dispositivo na mesma rede Wi-Fi/LAN:
EXPO_PUBLIC_API_URL=http://192.168.1.100:8080
```

#### Tabela de Referência de Endereços

| Onde o Mobile está rodando | Valor de `EXPO_PUBLIC_API_URL` |
| :--- | :--- |
| **Celular físico (Android / iOS)** na mesma rede Wi-Fi | `http://<IPv4_DA_MAQUINA_BACKEND>:8080` *(ex: `http://192.168.1.100:8080`)* |
| **Emulador Android** (na mesma máquina do backend) | `http://10.0.2.2:8080` |
| **Simulador iOS / Web** (na mesma máquina do backend) | `http://localhost:8080` |
| **Outro computador na rede** | `http://<IPv4_DA_MAQUINA_BACKEND>:8080` |

### Passo 4: Iniciar o Mobile e conectar o Dispositivo Físico

1. Conecte o celular na **mesma rede Wi-Fi** do computador.
2. Na pasta `mobile/`, inicie o Expo limpando o cache para carregar o novo `.env`:
   ```bash
   npx expo start -c
   ```
3. Abra o aplicativo **Expo Go** no celular e escaneie o **QR Code** exibido no terminal.

> **Dica (Redes Corporativas ou com Isolamento de Wi-Fi):**
> Caso o celular não consiga se conectar ao servidor Metro do Expo na rede local, inicie o Expo em modo túnel:
> ```bash
> npx expo start --tunnel
> ```

---

## 5. Executando o Projeto Completo em um Novo Computador

Caso queira clonar e rodar todo o ambiente (Backend + Web Admin + Mobile) em outra máquina do zero:

```bash
# 1. Clonar o repositório
git clone <URL_DO_REPOSITORIO>
cd field-ops

# 2. Subir o Backend (Terminal 1)
cd backend
./mvnw spring-boot:run        # No Windows: .\mvnw.cmd spring-boot:run

# 3. Subir a Interface Administrativa Web (Terminal 2)
cd ../web
npm install
npm start

# 4. Subir o Mobile (Terminal 3)
cd ../mobile
npm install
npx expo start
```

---

## 6. Executando os Testes

- **Backend (JUnit 5 / Spring Boot Test):**
  ```powershell
  cd backend
  .\mvnw.cmd test
  ```
- **Web Admin (Angular + Karma/Jasmine + TypeScript):**
  ```bash
  cd web
  npm run typecheck
  npm run test:ci
  npm run build
  ```
- **Mobile (Node Test Runner + TypeScript):**
  ```bash
  cd mobile
  npm test
  npx tsc --noEmit
  ```
