---
name: pr-draft
description: >-
  Gera automaticamente o título e a descrição de um Pull Request (PR) analisando
  o histórico de commits e as alterações (diffs) da branch atual.
---

# PR Draft Generator

Esta skill analisa os commits e as alterações feitas na branch atual em relação à branch base (ex: `main`, `master` ou `develop`) para criar um título padronizado (Conventional Commits) e uma descrição clara e detalhada para o Pull Request.

---

## Fluxo de Execução

### 1. Identificar a branch atual e a branch base
1. Verifique a branch atual:
   ```bash
   git branch --show-current
   ```
2. Identifique a branch base de integração (verifique se existe `main`, `master` ou `develop`, ou pergunte ao usuário caso haja ambiguidade):
   ```bash
   git rev-parse --verify origin/main 2>/dev/null || git rev-parse --verify origin/master 2>/dev/null || git rev-parse --verify main
   ```

### 2. Coletar os commits e as alterações
1. Obtenha a lista resumida de commits exclusivos da branch atual:
   ```bash
   git log <branch_base>..HEAD --oneline
   ```
2. Obtenha detalhes dos commits (autor e mensagens completas):
   ```bash
   git log <branch_base>..HEAD --pretty=format:"- %h: %s (%an)"
   ```
3. Obtenha a lista dos arquivos alterados e volume de linhas:
   ```bash
   git diff --stat <branch_base>..HEAD
   ```
4. Se necessário para entender mudanças críticas de lógica, inspecione o diff de arquivos-chave:
   ```bash
   git diff <branch_base>..HEAD -- <arquivo>
   ```

### 3. Gerar o Título do PR
* Aplique a convenção de **Conventional Commits**:
  - `feat: <descrição>` para novas funcionalidades
  - `fix: <descrição>` para correção de bugs
  - `refactor: <descrição>` para refatoração de código sem alteração de comportamento
  - `docs: <descrição>` para documentação
  - `test: <descrição>` para testes
  - `chore: <descrição>` para manutenção, dependências ou tarefas gerais
* O título deve ser direto, conciso (máximo 72 caracteres) e focar no impacto principal da entrega.

### 4. Gerar a Descrição do PR
Estrutura padronizada para a descrição do PR:

```markdown
## 📌 Resumo
<!-- Explicação concisa do objetivo do PR e contexto da mudança -->

## 🛠️ Alterações Realizadas
<!-- Lista em tópicos das principais modificações técnicas implementadas -->
- ...
- ...

## 📜 Commits da Branch
<!-- Lista dos commits incluídos neste PR -->
- `hash` Mensagem do commit

## 🧪 Como Testar e Validar
<!-- Passo a passo para reproduzir ou validar o comportamento das alterações -->
1. ...
2. ...

## ✅ Checklist
- [ ] Código testado localmente
- [ ] Não introduz novos warnings ou quebras
- [ ] Documentação e comentários atualizados (se aplicável)
```

### 5. Apresentação ao Usuário
* Apresente o **Título sugerido** em destaque.
* Apresente a **Descrição** dentro de um bloco Markdown pronto para copiar e colar na plataforma (GitHub, GitLab, Azure DevOps, Bitbucket).
