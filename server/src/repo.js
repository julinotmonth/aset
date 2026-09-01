// Maps snake_case Postgres rows to the exact camelCase shapes the frontend
// already expects (see src/types.ts) — keeping this mapping in one place
// means every route just calls these and never touches raw SQL rows.
import { query, withTransaction } from './db.js';

const mapUser = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  position: r.position,
  role: r.role,
  assignedSite: r.assigned_site,
  avatarUrl: r.avatar_url ?? undefined,
  createdAt: toDateStr(r.created_at),
});

const mapSite = (r) => ({
  key: r.key,
  label: r.label,
  subtitle: r.subtitle,
  color: r.color,
  imageUrl: r.image_url,
  isDefault: r.is_default,
  createdAt: toDateStr(r.created_at),
});

const mapSparePart = (r) => ({
  id: r.id,
  sku: r.sku,
  name: r.name,
  category: r.category,
  productEnergy: r.product_energy,
  site: r.site,
  stock: r.stock,
  minStock: r.min_stock,
  unit: r.unit,
  priceEstimate: Number(r.price_estimate),
  status: r.status,
  lastInspected: toDateStr(r.last_inspected),
  specifications: r.specifications,
  imageUrl: r.image_url ?? undefined,
});

const mapLog = (r) => ({
  id: r.id,
  timestamp: r.timestamp,
  action: r.action,
  description: r.description,
  performedBy: r.performed_by,
  siteFrom: r.site_from ?? undefined,
  siteTo: r.site_to ?? undefined,
});

const mapGallery = (r) => ({
  id: r.id,
  site: r.site,
  src: r.src,
  caption: r.caption,
  description: r.description ?? undefined,
  uploadedBy: r.uploaded_by ?? undefined,
  isDefault: r.is_default,
  createdAt: toDateStr(r.created_at),
});

function toDateStr(value) {
  if (!value) return value;
  if (typeof value === 'string') return value;
  return value.toISOString().split('T')[0];
}

// ── Users ────────────────────────────────────────────────────────────────
export const Users = {
  async all() {
    const { rows } = await query('SELECT * FROM users ORDER BY created_at ASC');
    return rows.map(mapUser);
  },
  async findByEmail(email) {
    const { rows } = await query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
    return rows[0] || null; // raw row (includes password_hash) — only for auth checks
  },
  async findById(id) {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? mapUser(rows[0]) : null;
  },
  async countByRole(role) {
    const { rows } = await query('SELECT COUNT(*)::int AS count FROM users WHERE role = $1', [role]);
    return rows[0].count;
  },
  async insert({ id, name, email, passwordHash, position, role, assignedSite }) {
    const { rows } = await query(
      `INSERT INTO users (id, name, email, password_hash, position, role, assigned_site)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, name, email, passwordHash, position, role, assignedSite]
    );
    return mapUser(rows[0]);
  },
  async update(id, patch) {
    const fields = [];
    const values = [];
    let i = 1;
    const map = { name: 'name', position: 'position', role: 'role', assignedSite: 'assigned_site', avatarUrl: 'avatar_url' };
    for (const [key, col] of Object.entries(map)) {
      if (patch[key] !== undefined) {
        fields.push(`${col} = $${i++}`);
        values.push(patch[key]);
      }
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    const { rows } = await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
    return rows[0] ? mapUser(rows[0]) : null;
  },
  async remove(id) {
    const { rowCount } = await query('DELETE FROM users WHERE id = $1', [id]);
    return rowCount > 0;
  },
};

// ── Sites ────────────────────────────────────────────────────────────────
export const Sites = {
  async all() {
    const { rows } = await query('SELECT * FROM sites ORDER BY created_at ASC');
    return rows.map(mapSite);
  },
  async find(key) {
    const { rows } = await query('SELECT * FROM sites WHERE key = $1', [key]);
    return rows[0] ? mapSite(rows[0]) : null;
  },
  async insert({ key, label, subtitle, color, imageUrl }) {
    const { rows } = await query(
      `INSERT INTO sites (key, label, subtitle, color, image_url, is_default) VALUES ($1,$2,$3,$4,$5,FALSE) RETURNING *`,
      [key, label, subtitle, color, imageUrl]
    );
    return mapSite(rows[0]);
  },
  async update(key, patch) {
    const fields = [];
    const values = [];
    let i = 1;
    const map = { label: 'label', subtitle: 'subtitle', color: 'color', imageUrl: 'image_url' };
    for (const [k, col] of Object.entries(map)) {
      if (patch[k] !== undefined) {
        fields.push(`${col} = $${i++}`);
        values.push(patch[k]);
      }
    }
    if (fields.length === 0) return this.find(key);
    values.push(key);
    const { rows } = await query(`UPDATE sites SET ${fields.join(', ')} WHERE key = $${i} RETURNING *`, values);
    return rows[0] ? mapSite(rows[0]) : null;
  },
  async remove(key) {
    const { rowCount } = await query('DELETE FROM sites WHERE key = $1', [key]);
    return rowCount > 0;
  },
};

// ── Categories ───────────────────────────────────────────────────────────
export const Categories = {
  async get() {
    const [sp, pe] = await Promise.all([
      query('SELECT name FROM spare_part_categories ORDER BY name ASC'),
      query('SELECT name FROM product_energy_categories ORDER BY name ASC'),
    ]);
    return { sparePart: sp.rows.map((r) => r.name), productEnergy: pe.rows.map((r) => r.name) };
  },
  async addSparePart(name) {
    await query('INSERT INTO spare_part_categories (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    const { rows } = await query('SELECT name FROM spare_part_categories ORDER BY name ASC');
    return rows.map((r) => r.name);
  },
  async addProductEnergy(name) {
    await query('INSERT INTO product_energy_categories (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    const { rows } = await query('SELECT name FROM product_energy_categories ORDER BY name ASC');
    return rows.map((r) => r.name);
  },
};

// ── Spare Parts ──────────────────────────────────────────────────────────
export const SpareParts = {
  async all() {
    const { rows } = await query('SELECT * FROM spare_parts ORDER BY id ASC');
    return rows.map(mapSparePart);
  },
  async find(id) {
    const { rows } = await query('SELECT * FROM spare_parts WHERE id = $1', [id]);
    return rows[0] ? mapSparePart(rows[0]) : null;
  },
  async findBySkuAndSite(sku, site) {
    const { rows } = await query('SELECT * FROM spare_parts WHERE sku = $1 AND site = $2', [sku, site]);
    return rows[0] ? mapSparePart(rows[0]) : null;
  },
  async insert(p) {
    const { rows } = await query(
      `INSERT INTO spare_parts (id, sku, name, category, product_energy, site, stock, min_stock, unit, price_estimate, status, last_inspected, specifications, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [p.id, p.sku, p.name, p.category, p.productEnergy, p.site, p.stock, p.minStock, p.unit, p.priceEstimate, p.status, p.lastInspected, p.specifications, p.imageUrl || null]
    );
    return mapSparePart(rows[0]);
  },
  async update(id, patch) {
    const map = {
      sku: 'sku', name: 'name', category: 'category', productEnergy: 'product_energy', site: 'site',
      stock: 'stock', minStock: 'min_stock', unit: 'unit', priceEstimate: 'price_estimate', status: 'status',
      lastInspected: 'last_inspected', specifications: 'specifications', imageUrl: 'image_url',
    };
    const fields = [];
    const values = [];
    let i = 1;
    for (const [k, col] of Object.entries(map)) {
      if (patch[k] !== undefined) {
        fields.push(`${col} = $${i++}`);
        values.push(patch[k]);
      }
    }
    if (fields.length === 0) return this.find(id);
    values.push(id);
    const { rows } = await query(`UPDATE spare_parts SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
    return rows[0] ? mapSparePart(rows[0]) : null;
  },
  async remove(id) {
    const { rowCount } = await query('DELETE FROM spare_parts WHERE id = $1', [id]);
    return rowCount > 0;
  },
  async existsForSite(site) {
    const { rows } = await query('SELECT 1 FROM spare_parts WHERE site = $1 LIMIT 1', [site]);
    return rows.length > 0;
  },
  /** Atomically decrements the source item and increments/creates the
   * target item for a transfer, plus writes the log entry — all in one
   * DB transaction so a crash mid-way can never leave stock inconsistent. */
  async transfer({ sourceId, quantity, targetSite, performedBy, newId, logId, timestamp }) {
    return withTransaction(async (client) => {
      const { rows: srcRows } = await client.query('SELECT * FROM spare_parts WHERE id = $1 FOR UPDATE', [sourceId]);
      const source = srcRows[0];
      if (!source) throw Object.assign(new Error('Spare part tidak ditemukan.'), { status: 404 });
      if (source.site === targetSite) throw Object.assign(new Error('Site tujuan harus berbeda dari site asal.'), { status: 400 });
      if (quantity > source.stock) throw Object.assign(new Error('Jumlah transfer melebihi stok yang tersedia.'), { status: 400 });

      const status = (stock, minStock) => (stock <= 0 ? 'Critical' : stock <= minStock ? 'Low Stock' : 'In Stock');
      const newSourceStock = source.stock - quantity;
      const { rows: updatedSrcRows } = await client.query(
        'UPDATE spare_parts SET stock = $1, status = $2 WHERE id = $3 RETURNING *',
        [newSourceStock, status(newSourceStock, source.min_stock), sourceId]
      );

      const { rows: existingTargetRows } = await client.query(
        'SELECT * FROM spare_parts WHERE sku = $1 AND site = $2 FOR UPDATE',
        [source.sku, targetSite]
      );
      let updatedTarget;
      if (existingTargetRows[0]) {
        const t = existingTargetRows[0];
        const newTargetStock = t.stock + quantity;
        const { rows } = await client.query(
          'UPDATE spare_parts SET stock = $1, status = $2 WHERE id = $3 RETURNING *',
          [newTargetStock, status(newTargetStock, t.min_stock), t.id]
        );
        updatedTarget = rows[0];
      } else {
        const { rows } = await client.query(
          `INSERT INTO spare_parts (id, sku, name, category, product_energy, site, stock, min_stock, unit, price_estimate, status, last_inspected, specifications, image_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
          [newId, source.sku, source.name, source.category, source.product_energy, targetSite, quantity, source.min_stock, source.unit, source.price_estimate, status(quantity, source.min_stock), source.last_inspected, source.specifications, source.image_url]
        );
        updatedTarget = rows[0];
      }

      const description = `Transfer ${quantity} ${source.unit} ${source.name} dari Site ${String(source.site).toUpperCase()} ke Site ${String(targetSite).toUpperCase()}`;
      const { rows: logRows } = await client.query(
        `INSERT INTO activity_logs (id, "timestamp", action, description, performed_by, site_from, site_to)
         VALUES ($1,$2,'TRANSFER',$3,$4,$5,$6) RETURNING *`,
        [logId, timestamp, description, performedBy, source.site, targetSite]
      );

      return { source: mapSparePart(updatedSrcRows[0]), target: mapSparePart(updatedTarget), log: mapLog(logRows[0]) };
    });
  },
};

// ── Activity Logs ────────────────────────────────────────────────────────
export const Logs = {
  async all() {
    const { rows } = await query('SELECT * FROM activity_logs ORDER BY "timestamp" DESC, id DESC');
    return rows.map(mapLog);
  },
  async insert(l) {
    const { rows } = await query(
      `INSERT INTO activity_logs (id, "timestamp", action, description, performed_by, site_from, site_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [l.id, l.timestamp, l.action, l.description, l.performedBy, l.siteFrom || null, l.siteTo || null]
    );
    return mapLog(rows[0]);
  },
};

// ── Gallery ──────────────────────────────────────────────────────────────
export const Gallery = {
  async all() {
    const { rows } = await query('SELECT * FROM gallery ORDER BY created_at DESC, id DESC');
    return rows.map(mapGallery);
  },
  async find(id) {
    const { rows } = await query('SELECT * FROM gallery WHERE id = $1', [id]);
    return rows[0] ? mapGallery(rows[0]) : null;
  },
  async insert(g) {
    const { rows } = await query(
      `INSERT INTO gallery (id, site, src, caption, description, uploaded_by, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,FALSE) RETURNING *`,
      [g.id, g.site, g.src, g.caption, g.description || null, g.uploadedBy || null]
    );
    return mapGallery(rows[0]);
  },
  async remove(id) {
    const { rowCount } = await query('DELETE FROM gallery WHERE id = $1', [id]);
    return rowCount > 0;
  },
};
