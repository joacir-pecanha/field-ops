# Exemplo de Ficha de Inspeção

# Ficha de Inspeção de Equipamento

## 1. Identificação da inspeção

| Campo | Informação |
| --- | --- |
| Código da inspeção | INS-2026-00045 |
| Tipo de inspeção | Inspeção preventiva mensal |
| Status | Em andamento |
| Data da inspeção | 03/08/2026 |
| Horário de início | 09:15 |
| Horário de término | 10:05 |
| Inspetor responsável | Carlos Henrique Silva |
| Empresa responsável | FieldOps Serviços Técnicos |
| Ordem de serviço | OS-2026-0187 |

---

## 2. Template aplicado

| Campo | Informação |
| --- | --- |
| Nome do template | Inspeção Preventiva de Compressor de Ar |
| Código do template | TPL-COMP-PREV |
| Versão aplicada | 3.0 |
| Identificador da versão | TPL-COMP-PREV-V3 |
| Data de publicação | 15/07/2026 |
| Status da versão | Publicada |
| Tipo de equipamento associado | Compressor de ar |
| Total de seções | 4 |
| Total de itens | 12 |

> A inspeção permanece vinculada à versão 3.0, mesmo que uma nova versão do template seja publicada posteriormente.
> 

---

## 3. Dados do cliente

| Campo | Informação |
| --- | --- |
| Cliente | Indústria Modelo Ltda. |
| CNPJ | 12.345.678/0001-90 |
| Unidade | Unidade Sorocaba |
| Responsável local | Ana Paula Ferreira |
| Telefone | (15) 99999-9999 |
| E-mail | ana.ferreira@empresa.com.br |

---

## 4. Local da inspeção

| Campo | Informação |
| --- | --- |
| Local | Galpão de Produção 02 |
| Setor | Linha de Montagem |
| Endereço | Avenida Industrial, 1000 – Sorocaba/SP |
| Ponto de referência | Próximo ao quadro elétrico principal |
| Coordenadas | -23.5015, -47.4526 |

---

## 5. Equipamento inspecionado

| Campo | Informação |
| --- | --- |
| Equipamento | Compressor de ar |
| Tipo de equipamento | Compressor de ar |
| Código interno | COMP-004 |
| Fabricante | Atlas Modelo |
| Modelo | XPTO 500 |
| Número de série | SN-458796 |
| Ano de fabricação | 2021 |
| Data da última manutenção | 10/05/2026 |
| Horímetro | 3.845 horas |
| Situação operacional | Em funcionamento |

---

# 6. Checklist de inspeção

## 6.1 Condições gerais

### Item 1 — Identificação do equipamento

| Campo | Informação |
| --- | --- |
| Código do item no template | COMP-GER-001 |
| Snapshot do item | SNAP-INS-00045-001 |
| Tipo de resposta | Seleção única |
| Resposta obrigatória | Sim |
| Evidência obrigatória | Sim |

**Pergunta:** A placa de identificação está presente, legível e fixada corretamente?

- [x]  Conforme
- [ ]  Não conforme
- [ ]  Não aplicável
- [ ]  Não foi possível verificar

**Observação:** Placa presente e com todas as informações legíveis.

**Evidência registrada:** EVD-001 — Fotografia da placa de identificação.

---

### Item 2 — Limpeza e conservação

| Campo | Informação |
| --- | --- |
| Código do item no template | COMP-GER-002 |
| Snapshot do item | SNAP-INS-00045-002 |
| Tipo de resposta | Seleção única |
| Resposta obrigatória | Sim |
| Evidência em caso de não conformidade | Obrigatória |

**Pergunta:** O equipamento apresenta condições adequadas de limpeza e conservação?

- [ ]  Conforme
- [x]  Não conforme
- [ ]  Não aplicável
- [ ]  Não foi possível verificar

**Observação:** Foi identificado acúmulo de óleo e poeira próximo à base do equipamento.

**Classificação da não conformidade:** Leve.

**Evidência registrada:** EVD-002 — Fotografia da região com acúmulo de resíduos.

---

### Item 3 — Estrutura externa

| Campo | Informação |
| --- | --- |
| Código do item no template | COMP-GER-003 |
| Snapshot do item | SNAP-INS-00045-003 |
| Tipo de resposta | Seleção única |
| Resposta obrigatória | Sim |

**Pergunta:** A estrutura externa está livre de trincas, deformações ou corrosão?

- [x]  Conforme
- [ ]  Não conforme
- [ ]  Não aplicável
- [ ]  Não foi possível verificar

**Observação:** Não foram identificados danos estruturais aparentes.

---

## 6.2 Segurança

### Item 4 — Proteções mecânicas

| Campo | Informação |
| --- | --- |
| Código do item no template | COMP-SEG-001 |
| Snapshot do item | SNAP-INS-00045-004 |
| Tipo de resposta | Seleção única |
| Resposta obrigatória | Sim |

**Pergunta:** As proteções das partes móveis estão instaladas e fixadas corretamente?

- [x]  Conforme
- [ ]  Não conforme
- [ ]  Não aplicável
- [ ]  Não foi possível verificar

**Observação:** Todas as proteções estavam instaladas e sem folgas.

---

### Item 5 — Sinalização de segurança

| Campo | Informação |
| --- | --- |
| Código do item no template | COMP-SEG-002 |
| Snapshot do item | SNAP-INS-00045-005 |
| Tipo de resposta | Seleção única |
| Resposta obrigatória | Sim |
| Evidência em caso de não conformidade | Obrigatória |

**Pergunta:** As etiquetas e sinalizações de advertência estão visíveis e legíveis?

- [ ]  Conforme
- [x]  Não conforme
- [ ]  Não aplicável
- [ ]  Não foi possível verificar

**Observação:** A etiqueta de risco elétrico está parcialmente apagada.

**Classificação da não conformidade:** Moderada.

**Ação recomendada:** Substituir a etiqueta de advertência.

**Evidência registrada:** EVD-003 — Fotografia da etiqueta danificada.

---

### Item 6 — Botão de emergência

| Campo | Informação |
| --- | --- |
| Código do item no template | COMP-SEG-003 |
| Snapshot do item | SNAP-INS-00045-006 |
| Tipo de resposta | Seleção única com teste |
| Resposta obrigatória | Sim |
| Teste obrigatório | Sim |

**Pergunta:** O botão de parada de emergência está acessível e funcionando corretamente?

- [x]  Conforme
- [ ]  Não conforme
- [ ]  Não aplicável
- [ ]  Não foi possível verificar

**Teste realizado:** Acionamento do botão durante operação controlada.

**Resultado:** O equipamento foi desligado imediatamente.

---

## 6.3 Sistema elétrico

### Item 7 — Cabos e conexões

| Campo | Informação |
| --- | --- |
| Código do item no template | COMP-ELE-001 |
| Snapshot do item | SNAP-INS-00045-007 |
| Tipo de resposta | Seleção única |
| Resposta obrigatória | Sim |
| Evidência em caso de não conformidade | Obrigatória |
| Gera bloqueio operacional | Sim |

**Pergunta:** Os cabos elétricos estão íntegros, organizados e sem condutores expostos?

- [ ]  Conforme
- [x]  Não conforme
- [ ]  Não aplicável
- [ ]  Não foi possível verificar

**Observação:** Um cabo de alimentação apresenta desgaste na cobertura externa.

**Classificação da não conformidade:** Crítica.

**Ação imediata:** Isolar o equipamento até a substituição do cabo.

**Evidência registrada:** EVD-004 — Fotografia do cabo elétrico.

---

### Item 8 — Painel elétrico

| Campo | Informação |
| --- | --- |
| Código do item no template | COMP-ELE-002 |
| Snapshot do item | SNAP-INS-00045-008 |
| Tipo de resposta | Seleção única |
| Resposta obrigatória | Sim |

**Pergunta:** O painel elétrico está fechado, identificado e sem sinais de aquecimento?

- [x]  Conforme
- [ ]  Não conforme
- [ ]  Não aplicável
- [ ]  Não foi possível verificar

**Observação:** Painel em condições normais, sem sinais visíveis de superaquecimento.

---

### Item 9 — Aterramento

| Campo | Informação |
| --- | --- |
| Código do item no template | COMP-ELE-003 |
| Snapshot do item | SNAP-INS-00045-009 |
| Tipo de resposta | Medição numérica |
| Unidade | Ω |
| Resposta obrigatória | Sim |
| Valor mínimo | 0 Ω |
| Valor máximo | 10 Ω |

**Pergunta:** Qual é a resistência medida no sistema de aterramento?

**Valor medido:** 4,2 Ω.

**Limite estabelecido:** Até 10 Ω.

**Resultado calculado:** Conforme.

---

## 6.4 Funcionamento

### Item 10 — Ruídos e vibrações

| Campo | Informação |
| --- | --- |
| Código do item no template | COMP-FUN-001 |
| Snapshot do item | SNAP-INS-00045-010 |
| Tipo de resposta | Seleção única |
| Resposta obrigatória | Sim |
| Evidência em caso de não conformidade | Obrigatória |

**Pergunta:** O equipamento opera sem ruídos ou vibrações anormais?

- [ ]  Conforme
- [x]  Não conforme
- [ ]  Não aplicável
- [ ]  Não foi possível verificar

**Observação:** Foi observado aumento de vibração durante o funcionamento em carga máxima.

**Classificação da não conformidade:** Moderada.

**Ação recomendada:** Verificar alinhamento, rolamentos e elementos de fixação.

**Evidência registrada:** EVD-005 — Vídeo do equipamento em funcionamento.

---

### Item 11 — Pressão de operação

| Campo | Informação |
| --- | --- |
| Código do item no template | COMP-FUN-002 |
| Snapshot do item | SNAP-INS-00045-011 |
| Tipo de resposta | Medição numérica |
| Unidade | bar |
| Resposta obrigatória | Sim |
| Valor mínimo | 7 bar |
| Valor máximo | 8 bar |

**Pergunta:** Qual é a pressão de operação do equipamento?

**Valor medido:** 7,8 bar.

**Faixa permitida:** Entre 7 e 8 bar.

**Resultado calculado:** Conforme.

---

### Item 12 — Temperatura de operação

| Campo | Informação |
| --- | --- |
| Código do item no template | COMP-FUN-003 |
| Snapshot do item | SNAP-INS-00045-012 |
| Tipo de resposta | Medição numérica |
| Unidade | °C |
| Resposta obrigatória | Sim |
| Valor máximo | 85 °C |

**Pergunta:** Qual é a temperatura do equipamento durante a operação?

**Valor medido:** 72 °C.

**Limite permitido:** Até 85 °C.

**Resultado calculado:** Conforme.

---

# 7. Não conformidades identificadas

## NC-001 — Acúmulo de óleo e resíduos

| Campo | Informação |
| --- | --- |
| Item relacionado | Item 2 — Limpeza e conservação |
| Código do item | COMP-GER-002 |
| Snapshot relacionado | SNAP-INS-00045-002 |
| Severidade | Leve |
| Descrição | Acúmulo de óleo e poeira na base do equipamento |
| Risco associado | Queda, contaminação e dificuldade de identificação de vazamentos |
| Ação corretiva | Limpar a área e verificar a existência de vazamento |
| Responsável | Equipe de manutenção |
| Prazo | 05/08/2026 |
| Status | Aberta |

---

## NC-002 — Etiqueta de segurança danificada

| Campo | Informação |
| --- | --- |
| Item relacionado | Item 5 — Sinalização de segurança |
| Código do item | COMP-SEG-002 |
| Snapshot relacionado | SNAP-INS-00045-005 |
| Severidade | Moderada |
| Descrição | Etiqueta de risco elétrico parcialmente ilegível |
| Risco associado | Falha na comunicação do risco aos operadores |
| Ação corretiva | Substituir a etiqueta |
| Responsável | Técnico de segurança |
| Prazo | 07/08/2026 |
| Status | Aberta |

---

## NC-003 — Cabo elétrico danificado

| Campo | Informação |
| --- | --- |
| Item relacionado | Item 7 — Cabos e conexões |
| Código do item | COMP-ELE-001 |
| Snapshot relacionado | SNAP-INS-00045-007 |
| Severidade | Crítica |
| Descrição | Desgaste na cobertura externa do cabo de alimentação |
| Risco associado | Choque elétrico, curto-circuito ou incêndio |
| Ação imediata | Interromper o uso do equipamento |
| Ação corretiva | Substituir o cabo e realizar novo teste elétrico |
| Responsável | Manutenção elétrica |
| Prazo | Imediato |
| Status | Em tratamento |

---

## NC-004 — Vibração acima do padrão

| Campo | Informação |
| --- | --- |
| Item relacionado | Item 10 — Ruídos e vibrações |
| Código do item | COMP-FUN-001 |
| Snapshot relacionado | SNAP-INS-00045-010 |
| Severidade | Moderada |
| Descrição | Vibração anormal durante operação em carga máxima |
| Risco associado | Desgaste prematuro ou falha mecânica |
| Ação corretiva | Verificar rolamentos, alinhamento e fixação |
| Responsável | Manutenção mecânica |
| Prazo | 06/08/2026 |
| Status | Aberta |

---

# 8. Evidências registradas

| Evidência | Item relacionado | Tipo | Descrição |
| --- | --- | --- | --- |
| EVD-001 | COMP-GER-001 | Fotografia | Placa de identificação do equipamento |
| EVD-002 | COMP-GER-002 | Fotografia | Acúmulo de óleo próximo à base |
| EVD-003 | COMP-SEG-002 | Fotografia | Etiqueta de risco elétrico danificada |
| EVD-004 | COMP-ELE-001 | Fotografia | Cabo elétrico com desgaste |
| EVD-005 | COMP-FUN-001 | Vídeo | Vibração durante operação em carga máxima |
| EVD-006 | COMP-ELE-003 | Documento | Relatório de medição do aterramento |

---

# 9. Resultado da inspeção

## Resumo

| Resultado | Quantidade |
| --- | --- |
| Itens conformes | 8 |
| Itens não conformes | 4 |
| Itens não aplicáveis | 0 |
| Itens não verificados | 0 |
| Total de itens | 12 |

**Percentual de conformidade:** 66,7%

## Classificação final

- [ ]  Aprovado
- [x]  Aprovado com restrições
- [ ]  Reprovado
- [ ]  Inspeção incompleta

## Parecer do inspetor

O equipamento apresenta condições gerais satisfatórias, porém foi identificada uma não conformidade crítica relacionada ao cabo de alimentação.

O equipamento deve permanecer fora de operação até que o cabo seja substituído e uma nova verificação elétrica seja realizada.

Também deverão ser corrigidas as não conformidades relacionadas à sinalização de segurança, à limpeza da base e à vibração durante a operação.

---

# 10. Rastreabilidade do template

| Campo | Informação |
| --- | --- |
| Template aplicado | Inspeção Preventiva de Compressor de Ar |
| Código do template | TPL-COMP-PREV |
| Versão aplicada | 3.0 |
| Identificador da versão | TPL-COMP-PREV-V3 |
| Quantidade de itens copiados | 12 |
| Data de criação dos snapshots | 03/08/2026 às 09:15 |
| Alterações posteriores permitidas | Não |
| Integridade dos snapshots | Validada |

Cada item apresentado nesta inspeção foi copiado da versão do template vigente no momento da abertura da inspeção.

Os snapshots preservam:

- o código do item;
- o título;
- a pergunta;
- o tipo de resposta;
- as opções disponíveis;
- a unidade de medida;
- os valores mínimos e máximos;
- as regras de obrigatoriedade;
- os critérios de conformidade;
- as exigências de evidência;
- a ordem do item;
- a seção de origem.

---

# 11. Próximas ações

| Ação | Responsável | Prazo | Status |
| --- | --- | --- | --- |
| Substituir o cabo de alimentação | Manutenção elétrica | Imediato | Pendente |
| Realizar nova inspeção elétrica | Inspetor responsável | Após o reparo | Pendente |
| Substituir a etiqueta de advertência | Técnico de segurança | 07/08/2026 | Pendente |
| Limpar a base do equipamento | Manutenção | 05/08/2026 | Pendente |
| Verificar vibração e alinhamento | Manutenção mecânica | 06/08/2026 | Pendente |

---

# 12. Assinaturas

## Inspetor

**Nome:** Carlos Henrique Silva

**Data:** 03/08/2026

**Assinatura:** ______________________________________

## Responsável pelo local

**Nome:** Ana Paula Ferreira

**Data:** 03/08/2026

**Assinatura:** ______________________________________

## Revisor da inspeção

**Nome:** ___________________________________________

**Data:** **/**/________

**Decisão:**

- [ ]  Aprovada
- [ ]  Devolvida para correção
- [ ]  Necessita de nova inspeção

**Comentários do revisor:**