---

## 📌 Resumo
<!-- Resumo executivo de 2 a 3 frases explicando o propósito da mudança e o problema resolvido -->

## 🎯 Rastreabilidade e Governança (SDD)
- **Tarefa (Task):** [TASK-XXX](base-conhecimento/governance/tasks/...) <!-- ou N/A se chore/infra/docs -->
- **Especificação (Spec):** [SPEC-XXX](base-conhecimento/governance/specs/...) <!-- ou N/A -->
- **Módulo / Escopo:** [Mobile Expo | Backend API | Web Admin | Governança/Docs]
- **Tipo de Alteração:** [feat | fix | refactor | docs | test | chore]

## 🛠️ Alterações Realizadas
<!-- Bullet points técnicos e concisos das principais mudanças implementadas -->
- ...
- ...

## 📜 Commits da Branch
<!-- Lista dos commits incluídos neste Pull Request -->
- ...

## 🛡️ Quality Gate & Validações Técnicas
<!-- Bloco gerado pelo script run_quality_gate.py com o status de QA -->

## 🧪 Como Testar e Validar
<!-- Instruções passo a passo para o revisor testar e reproduzir o comportamento localmente -->
1. ...
2. ...

## ✅ Checklist de Definition of Done (DoD)
- [ ] Código segue as diretrizes arquiteturais do projeto (`docs/arquitetura.md` e `docs/definition-of-done.md`)
- [ ] Tipagem estática TypeScript validada sem erros (`npx tsc --noEmit` em `mobile/`)
- [ ] Testes automatizados executados e passando (se aplicável)
- [ ] Auditoria de segurança aprovada (nenhum segredo, credencial ou log sensível commitado)
- [ ] Princípio Offline-First e padrão Outbox preservados (quando alterado módulo Mobile)
- [ ] Documentação e especificações SDD atualizadas

---
