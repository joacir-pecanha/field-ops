# QR Codes de Demonstração — FieldOps MVP

Este diretório contém os arquivos PNG dos QR Codes dos 3 equipamentos cadastrados na massa de testes oficial (`R__demo_seed_data.sql`) para uso durante a demonstração E2E (`AC-RELEASE` Passo 10) com a banca avaliadora.

## Catálogo de Equipamentos

| Arquivo | QR Code | Código | Equipamento | Cliente / Local |
| :--- | :--- | :--- | :--- | :--- |
| [QR-FIELDOPS-GD001.png](./QR-FIELDOPS-GD001.png) | `QR-FIELDOPS-GD001` | `EQP-GD-001` | Gerador Diesel GD-001 | Indústria Alfa — Planta Sorocaba (`SITE-SOR-01`) |
| [QR-FIELDOPS-CP002.png](./QR-FIELDOPS-CP002.png) | `QR-FIELDOPS-CP002` | `EQP-CP-002` | Compressor Parafuso CP-002 | Indústria Alfa — Planta Sorocaba (`SITE-SOR-01`) |
| [QR-FIELDOPS-TR003.png](./QR-FIELDOPS-TR003.png) | `QR-FIELDOPS-TR003` | `EQP-TR-003` | Transformador Subestação TR-003 | Indústria Alfa — CD Campinas (`SITE-CMP-01`) |

## Como Regenerar os Arquivos

```bash
node scripts/generate-demo-qr-codes.mjs
```

> **Dica para demonstração:** Imprima os PNGs acima ou exiba `QR-FIELDOPS-GD001.png` em tela para leitura direta pela câmera do aplicativo mobile durante o Passo 10 do roteiro E2E.
