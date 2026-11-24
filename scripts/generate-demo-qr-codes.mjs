import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const require = createRequire(import.meta.url);
const QRCode = require(path.join(repoRoot, 'web', 'node_modules', 'qrcode'));

const outputDir = path.join(repoRoot, 'mobile', 'assets', 'demo-qr-codes');

const demoEquipments = [
  {
    code: 'EQP-GD-001',
    qrCode: 'QR-FIELDOPS-GD001',
    name: 'Gerador Diesel GD-001',
    site: 'Planta Sorocaba (SITE-SOR-01)',
  },
  {
    code: 'EQP-CP-002',
    qrCode: 'QR-FIELDOPS-CP002',
    name: 'Compressor Parafuso CP-002',
    site: 'Planta Sorocaba (SITE-SOR-01)',
  },
  {
    code: 'EQP-TR-003',
    qrCode: 'QR-FIELDOPS-TR003',
    name: 'Transformador Subestação TR-003',
    site: 'Centro de Distribuição Campinas (SITE-CMP-01)',
  },
];

async function generate() {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const item of demoEquipments) {
    const filePath = path.join(outputDir, `${item.qrCode}.png`);
    await QRCode.toFile(filePath, item.qrCode, {
      type: 'png',
      width: 512,
      margin: 3,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });
    const stats = fs.statSync(filePath);
    console.log(`[QR] Gerado ${path.relative(repoRoot, filePath)} (${stats.size} bytes) -> ${item.qrCode}`);
  }
}

generate().catch((err) => {
  console.error('[QR] Erro ao gerar QR Codes de demonstração:', err);
  process.exit(1);
});
