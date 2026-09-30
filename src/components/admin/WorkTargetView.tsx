// Tab "Work Target" di dalam Laporan Mingguan — pencapaian Work Target
// Divisi Inventory & Asset Management (sheet "WT 26").
//
// Beda dari tab lain di halaman ini: datanya SATU untuk seluruh perusahaan
// (bukan per site), dilaporkan PER BULAN (bukan per minggu), dan barisnya
// dikelompokkan di bawah "Work Target / Objective" (di sheet asli berupa sel
// gabung; backend src/workTarget.js sudah menurunkan No/Objective/Activity ke
// tiap baris Strategi/Guideline-nya, jadi di sini tinggal dikelompokkan lagi
// untuk ditampilkan). Sumber Sheet/Sync cuma untuk Super Admin karena
// mempengaruhi data yang dilihat semua site.
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import type { CSSProperties } from 'react';
import {
  Link2, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Search, Target, ListChecks, TrendingUp, Gauge, Lock,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from 'recharts';
import { api } from '../../lib/api';
import type { AuthState } from '../../types';

interface WorkTargetItem {
  id: string; noObjective: string; objective: string; activity: string;
  strategi: string; pic: string; targetRaw: string; targetAngka: number | null;
  pencapaian: Record<string, string>; bulanUrut: string[]; bulanTerakhir: string;
  capaianAngka: number | null; keterangan: string; urutan: number;
}

interface WorkTargetSource {
  sheetId: string; gid: string; autoSync: boolean; lastSyncAt: string | null; lastStatus: string;
}

type Status = 'tercapai' | 'dibawah' | 'belum';

const URUTAN_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const kontrol: CSSProperties = {
  padding: '.5rem .7rem', borderRadius: 10, background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.12)', color: 'var(--txt-primary)', fontSize: '.82rem',
};
const tombol: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.5rem .85rem', borderRadius: 10,
  background: 'rgba(255,255,255,.06)', color: 'var(--txt-primary)', border: '1px solid rgba(255,255,255,.14)', cursor: 'pointer',
};
const tooltipStyle: CSSProperties = {
  background: '#0F172A', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, fontSize: '.78rem',
};

const WARNA_STATUS: Record<Status, string> = { tercapai: '#00D084', dibawah: '#F87171', belum: '#94A3B8' };
const LABEL_STATUS: Record<Status, string> = { tercapai: 'Tercapai', dibawah: 'Di bawah target', belum: 'Belum ada data' };

/** "86%", "99,7%", "100" → angka. Kosong/tidak valid → null. */
const parseAngka = (raw: string | undefined): number | null => {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s.replace('%', '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
};

const statusItem = (it: WorkTargetItem): Status => {
  if (it.capaianAngka === null) return 'belum';
  if (it.targetAngka === null) return 'belum'; // ada capaian tapi target tak tercatat — tak bisa dinilai
  return it.capaianAngka >= it.targetAngka ? 'tercapai' : 'dibawah';
};

function KartuKpi({ ikon: Ikon, label, nilai, sub, warna }: {
  ikon: React.ElementType; label: string; nilai: string; sub?: string; warna: string;
}) {
  return (
    <div className="glass-panel" style={{ borderRadius: 14, padding: '.9rem 1.05rem', display: 'flex', gap: '.8rem', alignItems: 'center', flex: '1 1 200px' }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', background: `${warna}22`, color: warna, flexShrink: 0 }}>
        <Ikon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '.68rem', color: 'var(--txt-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--txt-primary)', lineHeight: 1.3 }}>{nilai}</div>
        {sub && <div style={{ fontSize: '.7rem', color: 'var(--txt-muted)' }}>{sub}</div>}
      </div>
    </div>
  );
}

const PALET_PIC = ['#00D084', '#60A5FA', '#FBBF24', '#C084FC', '#F472B6', '#22D3EE', '#F97316', '#A3E635', '#F87171'];

interface GrupObjective { key: string; no: string; objective: string; activity: string; baris: WorkTargetItem[] }

/** Target yang paling sering muncul di satu grup (semua baris satu Work Target
 * biasanya berbagi target yang sama, mis. 100% atau 5%). */
const targetGrup = (baris: WorkTargetItem[]): number | null => {
  const hitung = new Map<number, number>();
  for (const b of baris) if (b.targetAngka !== null) hitung.set(b.targetAngka, (hitung.get(b.targetAngka) ?? 0) + 1);
  let terbaik: number | null = null, n = 0;
  for (const [t, c] of hitung) if (c > n) { terbaik = t; n = c; }
  return terbaik;
};

type StatusLock = 'lock' | 'belum' | 'kosong' | 'vacant';

/** "Lock" = capaian bulan terakhir yang terisi sudah mencapai target. */
const statusLock = (it: WorkTargetItem): StatusLock => {
  if (it.pic.trim().toLowerCase() === 'vacant') return 'vacant';
  if (it.capaianAngka === null || it.targetAngka === null) return 'kosong';
  return it.capaianAngka >= it.targetAngka ? 'lock' : 'belum';
};

/** Satu kartu per Work Target: grafik garis per PIC + daftar siapa yang sudah
 * lock target dan siapa yang belum. */
function PanelObjective({ g, bulan }: { g: GrupObjective; bulan: string[] }) {
  const target = targetGrup(g.baris);

  // Satu garis per PIC (baris yang punya minimal satu nilai capaian). Nama PIC
  // yang kembar dalam satu grup dibedakan dengan nomor supaya tidak saling menimpa.
  const seri = useMemo(() => {
    const dipakai = new Map<string, number>();
    return g.baris
      .filter((r) => Object.values(r.pencapaian).some((v) => parseAngka(v) !== null))
      .map((r, i) => {
        const dasar = r.pic || 'Tanpa PIC';
        const n = (dipakai.get(dasar) ?? 0) + 1;
        dipakai.set(dasar, n);
        return { item: r, nama: n > 1 ? `${dasar} (${n})` : dasar, warna: PALET_PIC[i % PALET_PIC.length] };
      });
  }, [g.baris]);

  const data = useMemo(() => bulan.map((b) => ({
    bulan: b,
    ...Object.fromEntries(seri.map((x) => [x.nama, parseAngka(x.item.pencapaian[b])])),
  })), [bulan, seri]);

  const [lo, hi] = useMemo(() => {
    const nilai: number[] = [];
    for (const x of seri) for (const b of bulan) { const v = parseAngka(x.item.pencapaian[b]); if (v !== null) nilai.push(v); }
    if (target !== null) nilai.push(target);
    if (!nilai.length) return [0, 100];
    const kecil = Math.min(...nilai), besar = Math.max(...nilai);
    return [Math.max(0, Math.floor((kecil - 5) / 10) * 10), Math.ceil((besar + 2) / 5) * 5];
  }, [seri, bulan, target]);

  const hitung = { lock: 0, belum: 0, kosong: 0, vacant: 0 } as Record<StatusLock, number>;
  for (const r of g.baris) hitung[statusLock(r)]++;

  const warnaLock: Record<StatusLock, string> = { lock: '#00D084', belum: '#F87171', kosong: '#94A3B8', vacant: '#FBBF24' };
  const teksTarget = target === null ? '' : `${target}%`;

  return (
    <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.1rem' }}>
      <div style={{ display: 'flex', gap: '.6rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '.2rem' }}>
        <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--txt-primary)' }}>
          {g.no ? `${g.no}. ` : ''}{g.objective}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '.72rem', color: '#00D084', fontWeight: 600 }}>{hitung.lock} lock</span>
        <span style={{ fontSize: '.72rem', color: '#F87171', fontWeight: 600 }}>{hitung.belum} belum</span>
        {(hitung.kosong + hitung.vacant) > 0 && (
          <span style={{ fontSize: '.72rem', color: '#94A3B8', fontWeight: 600 }}>{hitung.kosong + hitung.vacant} tanpa data</span>
        )}
      </div>
      {g.activity && <div style={{ fontSize: '.72rem', color: 'var(--txt-muted)', marginBottom: '.75rem' }}>{g.activity}</div>}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '2 1 380px', minWidth: 300, height: 250 }}>
          {seri.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" vertical={false} />
                <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: 'var(--txt-muted)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[lo, hi]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: 'var(--txt-muted)' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: '.72rem' }} />
                {target !== null && (
                  <ReferenceLine y={target} stroke="rgba(0,208,132,.6)" strokeDasharray="4 4"
                    label={{ value: `Target ${teksTarget}`, fill: '#00D084', fontSize: 10, position: 'insideBottomRight' }} />
                )}
                {seri.map((x) => (
                  <Line key={x.nama} type="monotone" dataKey={x.nama} stroke={x.warna} strokeWidth={2.2}
                    dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--txt-muted)', fontSize: '.78rem', textAlign: 'center' }}>
              Belum ada data capaian untuk Work Target ini.
            </div>
          )}
        </div>

        {/* Siapa yang sudah lock target, siapa yang belum */}
        <div style={{ flex: '1 1 260px', minWidth: 240, display: 'grid', gap: '.4rem' }}>
          {g.baris.map((r) => {
            const st = statusLock(r);
            const bulanAda = Object.keys(r.pencapaian).filter((b) => parseAngka(r.pencapaian[b]) !== null);
            const capai = r.targetAngka === null ? 0 : bulanAda.filter((b) => (parseAngka(r.pencapaian[b]) ?? 0) >= (r.targetAngka ?? 0)).length;
            const kurang = st === 'belum' && r.capaianAngka !== null && r.targetAngka !== null ? r.targetAngka - r.capaianAngka : 0;
            return (
              <div key={r.id} style={{
                display: 'flex', gap: '.55rem', alignItems: 'center', padding: '.4rem .55rem', borderRadius: 10,
                background: `${warnaLock[st]}12`, border: `1px solid ${warnaLock[st]}33`,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '.76rem', fontWeight: 700, color: 'var(--txt-primary)' }}>{r.pic || '-'}</div>
                  <div style={{ fontSize: '.66rem', color: 'var(--txt-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.strategi}>
                    {r.strategi}
                  </div>
                  {bulanAda.length > 0 && (
                    <div style={{ fontSize: '.66rem', color: 'var(--txt-muted)' }}>
                      {r.bulanTerakhir}: {r.pencapaian[r.bulanTerakhir]} · {capai}/{bulanAda.length} bulan ≥ target
                    </div>
                  )}
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '.25rem', padding: '.15rem .5rem', borderRadius: 999,
                  fontSize: '.66rem', fontWeight: 700, whiteSpace: 'nowrap', color: warnaLock[st], background: `${warnaLock[st]}1F`,
                }}>
                  {st === 'lock' && <><Lock size={10} /> Lock {r.targetRaw}</>}
                  {st === 'belum' && <>Belum · -{kurang.toFixed(kurang % 1 ? 1 : 0)} poin</>}
                  {st === 'kosong' && <>Belum ada data</>}
                  {st === 'vacant' && <>Vacant</>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface Props { auth: AuthState; }

export function WorkTargetView({ auth }: Props) {
  const isSuperAdmin = auth.role === 'Super Admin';
  const [items, setItems] = useState<WorkTargetItem[]>([]);
  const [source, setSource] = useState<WorkTargetSource | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [menyinkron, setMenyinkron] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'error'; teks: string } | null>(null);
  const [panelSumberTerbuka, setPanelSumberTerbuka] = useState(false);
  const [urlSheet, setUrlSheet] = useState('');
  const [filterStatus, setFilterStatus] = useState<'SEMUA' | Status>('SEMUA');
  const [cari, setCari] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [data, src] = await Promise.all([
        api.get<WorkTargetItem[]>('/work-target'),
        api.get<WorkTargetSource | null>('/work-target/source'),
      ]);
      setItems(data);
      setSource(src);
    } catch (err) {
      setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Gagal memuat data Work Target.' });
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { void muat(); }, [muat]);

  const simpanSumber = async () => {
    try {
      const src = await api.post<WorkTargetSource>('/work-target/source', { sheetUrl: urlSheet, autoSync: true });
      setSource(src);
      setPesan({ tipe: 'ok', teks: 'Sumber sheet Work Target disimpan. Klik "Sync Sekarang" untuk menariknya.' });
      setPanelSumberTerbuka(false);
    } catch (err) {
      setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Gagal menyimpan sumber.' });
    }
  };

  const sinkronkan = async () => {
    setMenyinkron(true);
    setPesan(null);
    try {
      const hasil = await api.post<{ inserted: number; updated: number; removed: number; total: number; terbaca?: { targetIdx: number; bulan: string[] } }>('/work-target/sync', {});
      setPesan({ tipe: 'ok', teks: `Sinkron selesai — ${hasil.total} baris (${hasil.inserted} baru, ${hasil.updated} diperbarui${hasil.removed ? `, ${hasil.removed} dihapus karena sudah tak ada di sheet` : ''}).${hasil.terbaca ? ` Terbaca: kolom Target ${hasil.terbaca.targetIdx >= 0 ? 'ditemukan' : 'TIDAK ditemukan'}, bulan ${hasil.terbaca.bulan.map((x) => x.split('@')[0]).join(', ')}.` : ''}` });
      await muat();
    } catch (err) {
      setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Sinkronisasi gagal.' });
    } finally {
      setMenyinkron(false);
    }
  };

  // Kolom bulan yang ditampilkan: hanya yang benar-benar ada isinya di
  // minimal satu baris — supaya kolom bulan-bulan mendatang yang sudah
  // disiapkan admin sheet tapi belum diisi tidak jadi kolom kosong.
  const bulanTampil = useMemo(() => {
    const ada = new Set<string>();
    for (const it of items) for (const b of Object.keys(it.pencapaian)) ada.add(b);
    return URUTAN_BULAN.filter((b) => ada.has(b));
  }, [items]);

  const ringkasan = useMemo(() => {
    const objektif = new Set(items.map((i) => `${i.noObjective}|${i.objective}`));
    const hitung: Record<Status, number> = { tercapai: 0, dibawah: 0, belum: 0 };
    let jumlahCapaian = 0, nCapaian = 0;
    for (const it of items) {
      hitung[statusItem(it)]++;
      if (it.capaianAngka !== null) { jumlahCapaian += it.capaianAngka; nCapaian++; }
    }
    return {
      objektif: objektif.size, baris: items.length, hitung,
      rataCapaian: nCapaian ? jumlahCapaian / nCapaian : null, nCapaian,
    };
  }, [items]);

  // Rata-rata capaian seluruh baris yang punya nilai, per bulan.
  const dataTren = useMemo(() => bulanTampil.map((b) => {
    const nilai = items.map((i) => parseAngka(i.pencapaian[b])).filter((n): n is number => n !== null);
    return { bulan: b, 'Rata-rata Capaian': nilai.length ? Math.round((nilai.reduce((s, n) => s + n, 0) / nilai.length) * 10) / 10 : null };
  }), [items, bulanTampil]);

  const ditampilkan = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return items.filter((it) => {
      if (filterStatus !== 'SEMUA' && statusItem(it) !== filterStatus) return false;
      if (!q) return true;
      return `${it.noObjective} ${it.objective} ${it.strategi} ${it.pic} ${it.keterangan} ${it.activity}`.toLowerCase().includes(q);
    });
  }, [items, filterStatus, cari]);

  // Kelompokkan per Objective, mempertahankan urutan kemunculan di sheet.
  const grup = useMemo(() => {
    const urutan: string[] = [];
    const peta: Record<string, { no: string; objective: string; activity: string; baris: WorkTargetItem[] }> = {};
    for (const it of ditampilkan) {
      const key = `${it.noObjective}|${it.objective}`;
      if (!peta[key]) { peta[key] = { no: it.noObjective, objective: it.objective, activity: it.activity, baris: [] }; urutan.push(key); }
      peta[key].baris.push(it);
    }
    return urutan.map((k) => peta[k]);
  }, [ditampilkan]);

  // Grafik per Work Target selalu memakai SEMUA baris (tidak ikut filter
  // pencarian/status di atas) supaya tiap grafik tetap utuh.
  const grupSemua = useMemo(() => {
    const urutan: string[] = [];
    const peta: Record<string, GrupObjective> = {};
    for (const it of items) {
      const key = `${it.noObjective}|${it.objective}`;
      if (!peta[key]) { peta[key] = { key, no: it.noObjective, objective: it.objective, activity: it.activity, baris: [] }; urutan.push(key); }
      peta[key].baris.push(it);
    }
    return urutan.map((k) => peta[k]);
  }, [items]);

  const kosong = !memuat && !items.length;
  const kolomTotal = 3 + bulanTampil.length + 2;

  const warnaSel = (raw: string | undefined, target: number | null): string => {
    const n = parseAngka(raw);
    if (n === null || target === null) return 'var(--txt-primary)';
    return n >= target ? '#00D084' : '#F87171';
  };

  return (
    <>
      {/* Filter + aksi */}
      <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '.75rem', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt-muted)' }} />
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari objective / strategi / PIC…"
            style={{ ...kontrol, paddingLeft: '2rem', width: 260 }} />
        </div>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'SEMUA' | Status)} style={kontrol}>
          <option value="SEMUA">Semua Status</option>
          <option value="tercapai">Tercapai</option>
          <option value="dibawah">Di bawah target</option>
          <option value="belum">Belum ada data</option>
        </select>

        <div style={{ flex: 1 }} />

        {isSuperAdmin && (
          <>
            <button type="button" onClick={() => setPanelSumberTerbuka((v) => !v)}
              style={{ ...tombol, background: 'rgba(96,165,250,.12)', color: '#60A5FA', border: '1px solid rgba(96,165,250,.3)' }}>
              <Link2 size={15} /> Sumber Sheet
            </button>
            <button type="button" onClick={sinkronkan} disabled={menyinkron || !source}
              title={source ? 'Tarik ulang dari Google Spreadsheet' : 'Atur sumber sheet terlebih dahulu'}
              style={{ ...tombol, background: '#00D084', color: '#06281A', border: 'none', fontWeight: 600, padding: '.5rem .95rem', cursor: source ? 'pointer' : 'not-allowed', opacity: source ? 1 : .5 }}>
              {menyinkron ? <Loader2 size={15} /> : <RefreshCw size={15} />} Sync Sekarang
            </button>
          </>
        )}
      </div>

      {isSuperAdmin && panelSumberTerbuka && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '1.1rem 1.25rem', marginBottom: '1rem', display: 'grid', gap: '.75rem' }}>
          <label style={{ fontSize: '.78rem', color: 'var(--txt-muted)' }}>
            Link Google Spreadsheet tab Work Target (mis. tab "WT 26")
            <input value={urlSheet} onChange={(e) => setUrlSheet(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..."
              style={{ ...kontrol, display: 'block', width: '100%', marginTop: '.35rem' }} />
          </label>
          <div style={{ fontSize: '.72rem', color: 'var(--txt-muted)' }}>
            Klik tab "WT 26" dulu di Google Sheets, lalu copy URL dari address bar (ada <code>?gid=...</code> di belakangnya) —
            gid dibaca otomatis, tidak perlu ketik nama tab. Sheet harus dibagikan sebagai <strong>Anyone with the link — Viewer</strong>.
            Data ini berlaku untuk <strong>seluruh site</strong> (satu sheet untuk seluruh perusahaan). Disinkronkan otomatis tiap 5 menit.
            {source?.lastSyncAt && <> Sync terakhir: {new Date(source.lastSyncAt).toLocaleString('id-ID')} ({source.lastStatus}).</>}
          </div>
          <div>
            <button type="button" onClick={simpanSumber}
              style={{ padding: '.5rem 1rem', borderRadius: 10, background: '#00D084', color: '#06281A', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
              Simpan Sumber
            </button>
          </div>
        </div>
      )}

      {pesan && (
        <div style={{
          display: 'flex', gap: '.55rem', alignItems: 'flex-start', padding: '.7rem 1rem', borderRadius: 12, marginBottom: '1rem', fontSize: '.8rem',
          whiteSpace: 'pre-wrap',
          background: pesan.tipe === 'ok' ? 'rgba(0,208,132,.08)' : 'rgba(248,113,113,.08)',
          border: `1px solid ${pesan.tipe === 'ok' ? 'rgba(0,208,132,.3)' : 'rgba(248,113,113,.3)'}`,
          color: pesan.tipe === 'ok' ? '#00D084' : '#F87171',
        }}>
          {pesan.tipe === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{pesan.teks}</span>
        </div>
      )}

      {memuat && (
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', padding: '2rem', color: 'var(--txt-muted)' }}>
          <Loader2 size={16} /> Memuat Work Target…
        </div>
      )}

      {kosong && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '2rem', textAlign: 'center', color: 'var(--txt-muted)', fontSize: '.85rem' }}>
          Belum ada data Work Target.{' '}
          {isSuperAdmin
            ? 'Klik "Sumber Sheet", tempel link tab "WT 26", simpan, lalu "Sync Sekarang".'
            : 'Hubungi Super Admin untuk mengatur sumber sheet-nya.'}
        </div>
      )}

      {!memuat && !kosong && (
        <>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <KartuKpi ikon={Target} warna="#60A5FA" label="Work Target" nilai={String(ringkasan.objektif)}
              sub={`${ringkasan.baris} strategi/guideline`} />
            <KartuKpi ikon={Gauge} warna="#FBBF24" label="Rata-rata Capaian"
              nilai={ringkasan.rataCapaian === null ? '-' : `${ringkasan.rataCapaian.toFixed(1)}%`}
              sub={`dari ${ringkasan.nCapaian} baris yang sudah ada capaian`} />
            <KartuKpi ikon={TrendingUp} warna="#00D084" label="Tercapai" nilai={String(ringkasan.hitung.tercapai)}
              sub="capaian terakhir ≥ target" />
            <KartuKpi ikon={ListChecks} warna="#F87171" label="Di Bawah Target" nilai={String(ringkasan.hitung.dibawah)}
              sub={`${ringkasan.hitung.belum} belum ada data`} />
          </div>

          {dataTren.length > 1 && (
            <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--txt-primary)', marginBottom: '.75rem' }}>
                Rata-rata Pencapaian per Bulan
              </div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dataTren} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" vertical={false} />
                    <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: 'var(--txt-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: 'var(--txt-muted)' }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => `${v}%`} />
                    <ReferenceLine y={100} stroke="rgba(0,208,132,.5)" strokeDasharray="4 4" label={{ value: 'Target 100%', fill: '#00D084', fontSize: 10, position: 'insideTopRight' }} />
                    <Line type="monotone" dataKey="Rata-rata Capaian" stroke="#FBBF24" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--txt-primary)', margin: '0 0 .6rem .2rem' }}>
            Grafik per Work Target — siapa yang sudah lock target, siapa yang belum
          </div>
          <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.25rem' }}>
            {grupSemua.map((g) => <PanelObjective key={g.key} g={g} bulan={bulanTampil} />)}
          </div>

          <div className="glass-panel" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="simple-table" style={{ minWidth: 900 + bulanTampil.length * 60, borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--panel-solid, #10182b)' }}>
                    <th style={{ padding: '.55rem .7rem', textAlign: 'left', fontSize: '.7rem', color: 'var(--txt-muted)' }}>STRATEGI / GUIDELINE</th>
                    <th style={{ padding: '.55rem .7rem', textAlign: 'left', fontSize: '.7rem', color: 'var(--txt-muted)' }}>PIC</th>
                    <th style={{ padding: '.55rem .7rem', textAlign: 'right', fontSize: '.7rem', color: 'var(--txt-muted)' }}>TARGET</th>
                    {bulanTampil.map((b) => (
                      <th key={b} style={{ padding: '.55rem .5rem', textAlign: 'right', fontSize: '.7rem', color: 'var(--txt-muted)' }}>{b.toUpperCase()}</th>
                    ))}
                    <th style={{ padding: '.55rem .7rem', textAlign: 'left', fontSize: '.7rem', color: 'var(--txt-muted)' }}>STATUS</th>
                    <th style={{ padding: '.55rem .7rem', textAlign: 'left', fontSize: '.7rem', color: 'var(--txt-muted)' }}>KETERANGAN</th>
                  </tr>
                </thead>
                <tbody>
                  {grup.map((g) => (
                    <Fragment key={`${g.no}|${g.objective}`}>
                      <tr>
                        <td colSpan={kolomTotal} style={{ padding: '.6rem .7rem', background: 'rgba(96,165,250,.14)', borderTop: '1px solid rgba(255,255,255,.08)' }}>
                          <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#60A5FA' }}>
                            {g.no ? `${g.no}. ` : ''}{g.objective}
                          </div>
                          {g.activity && (
                            <div style={{ fontSize: '.72rem', color: 'var(--txt-muted)', marginTop: '.15rem' }}>
                              Activity: {g.activity}
                            </div>
                          )}
                        </td>
                      </tr>
                      {g.baris.map((it) => {
                        const st = statusItem(it);
                        return (
                          <tr key={it.id}>
                            <td style={{ padding: '.45rem .7rem', fontSize: '.76rem', color: 'var(--txt-primary)' }}>{it.strategi}</td>
                            <td style={{ padding: '.45rem .7rem', fontSize: '.74rem', color: it.pic.toLowerCase() === 'vacant' ? '#FBBF24' : 'var(--txt-muted)', whiteSpace: 'nowrap' }}>{it.pic || '-'}</td>
                            <td style={{ padding: '.45rem .7rem', fontSize: '.74rem', textAlign: 'right', color: 'var(--txt-muted)' }}>{it.targetRaw || '-'}</td>
                            {bulanTampil.map((b) => (
                              <td key={b} style={{ padding: '.45rem .5rem', fontSize: '.74rem', textAlign: 'right', fontWeight: 600, color: warnaSel(it.pencapaian[b], it.targetAngka) }}>
                                {it.pencapaian[b] || '-'}
                              </td>
                            ))}
                            <td style={{ padding: '.45rem .7rem', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-block', padding: '.15rem .55rem', borderRadius: 999, fontSize: '.68rem', fontWeight: 600,
                                color: WARNA_STATUS[st], background: `${WARNA_STATUS[st]}1F`, border: `1px solid ${WARNA_STATUS[st]}44`,
                              }}>
                                {LABEL_STATUS[st]}
                              </span>
                            </td>
                            <td style={{ padding: '.45rem .7rem', fontSize: '.72rem', color: 'var(--txt-muted)' }}>{it.keterangan || '-'}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                  {!grup.length && (
                    <tr><td colSpan={kolomTotal} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--txt-muted)', fontSize: '.78rem' }}>
                      Tidak ada baris yang cocok dengan filter.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.25rem', marginTop: '1rem', fontSize: '.78rem', color: 'var(--txt-muted)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--txt-primary)' }}>NB:</strong> Status dinilai dari capaian bulan terakhir yang terisi
            dibanding kolom Target (hijau = ≥ target, merah = di bawah target). Baris dengan PIC <em>Vacant</em> atau tanpa
            target/capaian tampil "Belum ada data". Data ini satu untuk seluruh perusahaan — bukan per site — dan diambil dari
            tab utama Work Target saja; tab pendukung per-site di spreadsheet yang sama (CP/PM/SO, Summary Asset, List PRS)
            belum ditarik.
          </div>
        </>
      )}
    </>
  );
}