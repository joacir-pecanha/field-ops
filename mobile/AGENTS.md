# Diretrizes para Agentes de IA — FieldOps Mobile

## 1. Autoridade e Governança Humana
- **Responsável Humano / Tech Lead:** Joacir Peçanha
- **Regra Fundamental de Governança:** Qualquer alteração arquitetural, quebra de contrato de API, alteração de schema do banco de dados (SQLite), exclusão de arquivos ou finalização de tarefa/épico **exige aprovação explícita de Joacir Peçanha**.
- O agente atua sob o modelo **Spec-Driven Development (SDD)**. Nenhuma linha de código de feature deve ser escrita sem uma especificação aprovada em `base-conhecimento/governance/specs/` e uma tarefa ativa em `base-conhecimento/governance/tasks/`.

## 2. Tecnologias e Versões Estritas (Expo v57)
- **Expo Framework:** Versão 57.x (`expo@~57.0.18`).
- **React Native:** `0.86.3` | **React:** `19.2.3`.
- **Navegação:** `expo-router` v57 (baseado em arquivos dentro de `src/app`).
- **Estado de Servidor & Cache:** `@tanstack/react-query` v5.
- **Estado Local / UI Efêmero:** `zustand` v5 (apenas para UI e sessão; nunca replicar dados persistidos do SQLite).
- **Formulários e Validação:** `react-hook-form` + `zod`.
- **Persistência Local (Offline-First):** SQLite (fonte da verdade operacional do técnico no campo).
- **Dados Sensíveis:** `expo-secure-store` para tokens JWT e credenciais de sessão.
- **Documentação de Referência Obrigatória:** Consulte a documentação oficial da versão exata: https://docs.expo.dev/versions/v57.0.0/ antes de adotar qualquer API ou padrão do Expo.

## 3. Princípios Arquiteturais Obrigatórios

### 3.1 Offline-First com Outbox Pattern
- Toda mutação de checklist, início de inspeção ou evidência fotográfica deve ser gravada **primeiro no SQLite**.
- O aplicativo nunca deve bloquear o técnico ou falhar por ausência de conectividade.
- Toda operação que necessite de sincronização com o backend deve gerar um registro na tabela `outbox_operations` contendo UUID idempotente (`id`), tipo de entidade, tipo de operação e payload serializado em JSON.
- A sincronização deve respeitar dependências e enviar dados estruturados antes dos uploads pesados de mídia.

### 3.2 Separação Rígida de Estados
- **Estados de Negócio da Inspeção:**
  `RASCUNHO` → `ATRIBUÍDA` → `EM_ANDAMENTO` → `ENVIADA` → `EM_REVISÃO` → `APROVADA` | `REPROVADA` | `CANCELADA`.
- **Estados Locais de Sincronização:**
  `SINCRONIZADO`, `PENDENTE`, `SINCRONIZANDO`, `ERRO`, `CONFLITO`.
- **Regra:** Nunca misture o estado de sincronização com o estado de negócio na camada de domínio ou persistência. Quando uma inspeção é concluída offline, o estado local indica conclusão, mas a UI apresenta *"Aguardando sincronização"* até a confirmação idempotente pela API.

### 3.3 Clean Architecture & Modularização
- `src/domain/`: Entidades puras, regras de negócio e tipos independentes de framework.
- `src/application/`: Casos de uso e coordenação de fluxo (iniciar inspeção, registrar resposta, disparar sincronização).
- `src/infrastructure/`: SQLite, repositórios, cliente API REST, armazenamento seguro e sensores nativos.
- `src/features/`: Módulos por capacidade de negócio (auth, inspections, checklist, evidence, scanner, sync).
- `src/design-system/`: Componentes atômicos reutilizáveis, tipografia e tokens de design.

## 4. Checklist do Agente Antes de Declarar Conclusão
- [ ] O código adere estritamente à tarefa ativa (`task.md`) e à especificação associada (`SPEC-XXX.md`)?
- [ ] A checagem de tipos estática passou com sucesso (`npx tsc --noEmit`) sem erros?
- [ ] Nenhum arquivo desnecessário ou arquivo de configuração temporário foi deixado para trás?
- [ ] Nenhum segredo, chave ou credencial foi hardcoded?
- [ ] Testes unitários foram criados ou atualizados para os novos casos de uso e schemas?
- [ ] O arquivo `task.md` foi atualizado com as evidências de teste e submetido para validação de Joacir Peçanha?
