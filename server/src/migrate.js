import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, query } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PASSWORD = 'reethau123';

async function runSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await query(sql);
  console.log('[migrate] Schema is up to date.');
}

async function seedSites() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM sites');
  if (rows[0].count > 0) return;

  const sites = [
    ['bekasi', 'Bekasi', 'Mother Station & Workshop', '#00D084', '/assets/images/cng-cylinder.webp'],
    ['indramayu', 'Indramayu', 'Daughter Station & Depot', '#60A5FA', '/assets/images/distribution-truck.webp'],
    ['blora', 'Blora', 'Wellhead & Processing Plant', '#FBBF24', '/assets/images/cng-pipe.webp'],
    ['setu', 'Setu', 'Compressor Station & Fleet Room', '#C084FC', '/assets/images/setu/setu-02.webp'],
  ];
  for (const [key, label, subtitle, color, imageUrl] of sites) {
    await query(
      `INSERT INTO sites (key, label, subtitle, color, image_url, is_default, created_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, '2026-01-01')`,
      [key, label, subtitle, color, imageUrl]
    );
  }
  console.log('[migrate] Seeded default sites.');
}

async function seedCategories() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM spare_part_categories');
  if (rows[0].count === 0) {
    const cats = ['Compressors', 'Cylinders & Storage', 'Valves & Control', 'Piping & Connectors', 'Instruments & Sensors', 'Filtration & Purification'];
    for (const name of cats) await query('INSERT INTO spare_part_categories (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    console.log('[migrate] Seeded default spare part categories.');
  }
  const { rows: peRows } = await query('SELECT COUNT(*)::int AS count FROM product_energy_categories');
  if (peRows[0].count === 0) {
    for (const name of ['CNG', 'LNG', 'Biomass']) await query('INSERT INTO product_energy_categories (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    console.log('[migrate] Seeded default product energy categories.');
  }
}

async function seedUsers() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM users');
  if (rows[0].count > 0) return;

  const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
  const users = [
    ['user-admin', 'Admin', 'admin@reethau.com', 'Super Admin', 'Super Admin', 'global', '2026-01-05'],
    ['user-hendra', 'Hendra Gunawan', 'hendra.gunawan@reethau.com', 'Site Manager Bekasi', 'Site Manager', 'bekasi', '2026-02-10'],
    ['user-budi', 'Budi Santoso', 'budi.santoso@reethau.com', 'Admin Inventaris', 'Maintenance Engineer', 'blora', '2026-03-18'],
  ];
  for (const [id, name, email, position, role, assignedSite, createdAt] of users) {
    await query(
      `INSERT INTO users (id, name, email, password_hash, position, role, assigned_site, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, name, email, passwordHash, position, role, assignedSite, createdAt]
    );
  }
  console.log(`[migrate] Seeded default users. Password for all seed accounts: "${DEFAULT_PASSWORD}"`);
}

async function seedSpareParts() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM spare_parts');
  if (rows[0].count > 0) return;

  const parts = [
    ['sp-101', 'CNG-VAL-001', 'High-Pressure Ball Valve 1/2" NPT (300 Bar)', 'Valves & Control', 'CNG', 'bekasi', 24, 10, 'Units', 3500000, 'In Stock', '2026-07-15', 'Stainless Steel 316L, Rated for 300 Bar CNG Mother Station dispenser line', null],
    ['sp-102', 'CNG-CMP-202', 'Bauer CNG Compressor Piston Seal Kit', 'Compressors', 'CNG', 'bekasi', 3, 5, 'Kits', 12500000, 'Low Stock', '2026-07-18', 'OEM Replacement seal kit for 4-stage high pressure compressor', null],
    ['sp-103', 'LNG-CYL-501', 'Microbulk Cryogenic Tank Safety Valve 24 Bar', 'Cylinders & Storage', 'LNG', 'indramayu', 15, 8, 'Units', 8750000, 'In Stock', '2026-07-10', 'Brass body, cryogenic PTFE seal for liquid natural gas storage (-162°C)', null],
    ['sp-104', 'BIO-PIP-109', 'Heavy Duty Biomass Conveyor Chain Sprocket 80B', 'Piping & Connectors', 'Biomass', 'blora', 8, 4, 'Units', 4200000, 'In Stock', '2026-07-12', 'Hardened carbon steel for woodchip & biomass feeder line', null],
    ['sp-105', 'CNG-PRU-305', 'Pressure Reduction Unit (PRU) Pilot Regulator', 'Valves & Control', 'CNG', 'indramayu', 2, 4, 'Units', 18500000, 'Low Stock', '2026-07-19', 'Dual stage pressure control 250 bar to 4 bar for Daughter Station', null],
    ['sp-106', 'LNG-SEN-801', 'Optical Methane Gas Leak Detector Sensor', 'Instruments & Sensors', 'LNG', 'bekasi', 1, 3, 'Units', 24000000, 'Critical', '2026-07-20', 'ATEX Zone 1 Explosion Proof Infrared Methane Detector', null],
    ['sp-107', 'CNG-FIL-402', 'Coalescing Oil Filter Element 250 Bar', 'Filtration & Purification', 'CNG', 'blora', 35, 15, 'Pcs', 1800000, 'In Stock', '2026-07-14', '0.01 Micron filtration efficiency for natural gas dehydration', null],
    ['sp-108', 'LNG-PMP-603', 'Submerged Cryogenic LNG Pump Bearing Set', 'Compressors', 'LNG', 'indramayu', 0, 2, 'Sets', 32000000, 'Maintenance Needed', '2026-07-08', 'Specialized ceramic ball bearings for submerged LNG transfer pumps', null],
    ['sp-109', 'CNG-VAL-511', 'Manifold Isolation Ball Valve 1" NPT (250 Bar)', 'Valves & Control', 'CNG', 'setu', 18, 8, 'Units', 4100000, 'In Stock', '2026-07-16', 'Forged carbon steel isolation valve for CNG mother station manifold rack', '/assets/images/setu/setu-05.webp'],
    ['sp-110', 'CNG-CMP-318', 'Compressor Interstage Cooler Fan Motor', 'Compressors', 'CNG', 'setu', 4, 3, 'Units', 9800000, 'In Stock', '2026-07-17', '3-phase induction motor, IP55, for 4-stage compressor cooling bank', '/assets/images/setu/setu-08.webp'],
    ['sp-111', 'CNG-INS-712', 'Digital Pressure Transmitter 0-400 Bar', 'Instruments & Sensors', 'CNG', 'setu', 2, 3, 'Units', 15200000, 'Low Stock', '2026-07-19', '4-20mA output, ATEX certified, panel-mount pressure telemetry sensor', '/assets/images/setu/setu-03.webp'],
    ['sp-112', 'CNG-FIL-455', 'HVAC Fleet Room Air Filter Cartridge', 'Filtration & Purification', 'CNG', 'setu', 22, 10, 'Pcs', 650000, 'In Stock', '2026-07-13', 'Washable pleated filter for fleet control room split-AC climate units', '/assets/images/setu/setu-13.webp'],
  ];
  for (const row of parts) {
    await query(
      `INSERT INTO spare_parts (id, sku, name, category, product_energy, site, stock, min_stock, unit, price_estimate, status, last_inspected, specifications, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      row
    );
  }
  console.log('[migrate] Seeded default spare parts.');
}

async function seedLogs() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM activity_logs');
  if (rows[0].count > 0) return;

  const logs = [
    ['log-1', '2026-07-21 14:30', 'TRANSFER', 'Transfer 5 unit High-Pressure Ball Valve dari Site Bekasi ke Site Indramayu', 'Hendra Gunawan (Site Manager Bekasi)', 'bekasi', 'indramayu'],
    ['log-2', '2026-07-20 09:15', 'STOCK_UPDATE', 'Pengadaan 10 unit Coalescing Oil Filter Element di Site Blora', 'Budi Santoso (Admin Inventaris)', 'blora', null],
    ['log-3', '2026-07-22 11:05', 'ADD_SPARE_PART', 'Registrasi aset baru Site Setu ke sistem inventaris terpusat beserta label QR aset', 'Admin (Super Admin)', 'setu', null],
  ];
  for (const row of logs) {
    await query(
      `INSERT INTO activity_logs (id, "timestamp", action, description, performed_by, site_from, site_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      row
    );
  }
  console.log('[migrate] Seeded default activity logs.');
}

async function seedGallery() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM gallery');
  if (rows[0].count > 0) return;

  const captions = [
    'Sambungan & Fitting Perpipaan Gas', 'Jalur Distribusi Pipa Compressor Station', 'Unit Meter Turbin Gas',
    'Panel Kontrol Elektrikal Site', 'Regulator & Valve Tekanan Tinggi', 'Rangkaian Skid Instrumentasi',
    'Plat Spesifikasi Peralatan', 'Area Skid Compressor Terbungkus', 'Gardu & Jaringan Listrik Site',
    'Panel Distribusi Daya Site Setu', 'APAR & Perlengkapan Keselamatan', 'Instalasi Skid & Rak Peralatan',
    'Unit AC Ruang Fleet', 'Unit AC Ruang Fleet (Tampak Lain)', 'Label Barcode Aset Terdaftar',
    'Label Barcode Aset pada Furnitur Site',
  ];
  for (let i = 0; i < captions.length; i++) {
    const n = String(i + 1).padStart(2, '0');
    await query(
      `INSERT INTO gallery (id, site, src, caption, is_default, created_at)
       VALUES ($1, 'setu', $2, $3, TRUE, '2026-01-01')`,
      [`gal-setu-${n}`, `/assets/images/setu/setu-${n}.webp`, captions[i]]
    );
  }
  console.log('[migrate] Seeded default gallery photos.');
}

export async function migrate() {
  await runSchema();
  await seedSites();
  await seedCategories();
  await seedUsers();
  await seedSpareParts();
  await seedLogs();
  await seedGallery();
}

// Allows running standalone: `npm run migrate`
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => {
      console.log('[migrate] Done.');
      return pool.end();
    })
    .catch((err) => {
      console.error('[migrate] Failed:', err);
      process.exit(1);
    });
}
