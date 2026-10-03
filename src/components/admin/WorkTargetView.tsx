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
  Link2, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Search, Target, ListChecks, TrendingUp, TrendingDown, Gauge, Lock,
  CircleDashed, UserX,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from 'recharts';
import { api } from '../../lib/api';
import type { AuthState } from '../../types';
import {
  NADA, SERI_PANJANG, POLA_GARIS, tooltipProps, fmtLegend, WR_CSS, useWrTema,
} from './wrTema';
import type { Nada, WrTema } from './wrTema';

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

// Warna kontrol/tombol datang dari kelas .wr-ctl / .wr-btn (WR_CSS) — di sini
// hanya tata letak.
const kontrol: CSSProperties = { padding: '.5rem .7rem', borderRadius: 10, fontSize: '.82rem' };
const tombol: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.5rem .85rem', borderRadius: 10, cursor: 'pointer',
};

const NADA_STATUS: Record<Status, Nada> = { tercapai: NADA.in, dibawah: NADA.neg, belum: NADA.neutral };
// Ikon = pembeda selain warna pada badge status.
const IKON_STATUS: Record<Status, React.ElementType> = { tercapai: CheckCircle2, dibawah: TrendingDown, belum: CircleDashed };
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

function KartuKpi({ ikon: Ikon, label, nilai, sub, nada }: {
  ikon: React.ElementType; label: string; nilai: string; sub?: string; nada: Nada;
}) {
  return (
    <div className="glass-panel" style={{ borderRadius: 14, padding: '.9rem 1.05rem', display: 'flex', gap: '.8rem', alignItems: 'center', flex: '1 1 200px' }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', background: nada.bg, color: nada.teks, border: `1px solid ${nada.garis}`, flexShrink: 0 }}>
        <Ikon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '.68rem', color: 'var(--wr-txt-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--txt-primary)', lineHeight: 1.3 }}>{nilai}</div>
        {sub && <div style={{ fontSize: '.7rem', color: 'var(--wr-txt-muted)' }}>{sub}</div>}
      </div>
    </div>
  );
}

const PALET_PIC = SERI_PANJANG;

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

const NADA_LOCK: Record<StatusLock, Nada> = { lock: NADA.in, belum: NADA.neg, kosong: NADA.neutral, vacant: NADA.warn };
const IKON_LOCK: Record<StatusLock, React.ElementType> = { lock: Lock, belum: TrendingDown, kosong: CircleDashed, vacant: UserX };

/** Satu kartu per Work Target: grafik garis per PIC + daftar siapa yang sudah
 * lock target dan siapa yang belum. */
function PanelObjective({ g, bulan, tema }: { g: GrupObjective; bulan: string[]; tema: WrTema }) {
  const { W, rv } = tema;
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
        return {
          item: r, nama: n > 1 ? `${dasar} (${n})` : dasar,
          warna: PALET_PIC[i % PALET_PIC.length], pola: POLA_GARIS[i % POLA_GARIS.length],
        };
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

  const teksTarget = target === null ? '' : `${target}%`;
  const adaGrafik = seri.length > 0;

  // Siapa yang sudah lock target, siapa yang belum. Tanpa grafik, daftar
  // memakai seluruh lebar kartu dalam beberapa kolom supaya tidak ada area kosong.
  const daftar = (
    <div style={{
      display: 'grid', gap: '.45rem', minWidth: 0,
      gridTemplateColumns: adaGrafik ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
    }}>
      {g.baris.map((r) => {
        const st = statusLock(r);
        const n = NADA_LOCK[st];
        const IkonSt = IKON_LOCK[st];
        const bulanAda = Object.keys(r.pencapaian).filter((b) => parseAngka(r.pencapaian[b]) !== null);
        const capai = r.targetAngka === null ? 0 : bulanAda.filter((b) => (parseAngka(r.pencapaian[b]) ?? 0) >= (r.targetAngka ?? 0)).length;
        const kurang = st === 'belum' && r.capaianAngka !== null && r.targetAngka !== null ? r.targetAngka - r.capaianAngka : 0;
        return (
          <div key={r.id} style={{
            display: 'flex', gap: '.6rem', alignItems: 'center', padding: '.5rem .65rem', borderRadius: 10, minWidth: 0,
            background: n.bg, border: `1px solid ${n.garis}`,
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--txt-primary)' }}>{r.pic || '-'}</div>
              {/* Maks. 2 baris: ujung teks (nama site) yang membedakan tiap strategi tidak boleh terpotong. */}
              <div title={r.strategi} style={{
                fontSize: '.68rem', color: 'var(--txt-secondary)', lineHeight: 1.35, overflowWrap: 'anywhere',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {r.strategi}
              </div>
              {bulanAda.length > 0 && (
                <div style={{ fontSize: '.68rem', color: 'var(--txt-secondary)', marginTop: 1 }}>
                  {r.bulanTerakhir}: {r.pencapaian[r.bulanTerakhir]} · {capai}/{bulanAda.length} bulan ≥ target
                </div>
              )}
            </div>
            <span style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '.28rem', padding: '.18rem .55rem',
              borderRadius: 999, fontSize: '.68rem', fontWeight: 700, whiteSpace: 'nowrap',
              color: n.teks, background: 'var(--wr-field-bg)', border: `1px solid ${n.garis}`,
            }}>
              <IkonSt size={11} aria-hidden="true" />
              {st === 'lock' && <>Lock {r.targetRaw}</>}
              {st === 'belum' && <>Belum · -{kurang.toFixed(kurang % 1 ? 1 : 0)} poin</>}
              {st === 'kosong' && <>Belum ada data</>}
              {st === 'vacant' && <>Vacant</>}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.1rem', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: '.6rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '.2rem' }}>
        <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--txt-primary)' }}>
          {g.no ? `${g.no}. ` : ''}{g.objective}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '.72rem', color: NADA.in.teks, fontWeight: 600 }}>{hitung.lock} lock</span>
        <span style={{ fontSize: '.72rem', color: NADA.neg.teks, fontWeight: 600 }}>{hitung.belum} belum</span>
        {(hitung.kosong + hitung.vacant) > 0 && (
          <span style={{ fontSize: '.72rem', color: NADA.neutral.teks, fontWeight: 600 }}>{hitung.kosong + hitung.vacant} tanpa data</span>
        )}
      </div>
      {g.activity && <div style={{ fontSize: '.72rem', color: 'var(--wr-txt-muted)', marginBottom: '.75rem' }}>{g.activity}</div>}

      {adaGrafik ? (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '2 1 380px', minWidth: 'min(100%, 300px)', height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: W['--wr-txt-muted'] }} axisLine={false} tickLine={false} />
                <YAxis domain={[lo, hi]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: W['--wr-txt-muted'] }} axisLine={false} tickLine={false} width={44} />
                <Tooltip {...tooltipProps} formatter={(v: unknown) => `${v}%`} cursor={{ stroke: W['--wr-cursor'] }} />
                <Legend wrapperStyle={{ fontSize: '.72rem' }} formatter={fmtLegend} />
                {target !== null && (
                  <ReferenceLine y={target} stroke={W['--wr-in']} strokeOpacity={0.7} strokeDasharray="4 4"
                    label={{ value: `Target ${teksTarget}`, fill: W['--wr-in-text'], fontSize: 11, position: 'insideTopRight' }} />
                )}
                {seri.map((x) => (
                  <Line key={x.nama} type="monotone" dataKey={x.nama} stroke={rv(x.warna)} strokeDasharray={x.pola}
                    strokeWidth={2.2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: '1 1 280px', minWidth: 'min(100%, 260px)' }}>{daftar}</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '.76rem', color: 'var(--wr-txt-muted)', marginBottom: '.6rem' }}>
            Belum ada data capaian untuk Work Target ini.
          </div>
          {daftar}
        </>
      )}
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
  const tema = useWrTema();
  const { W } = tema;

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
    return n >= target ? NADA.in.teks : NADA.neg.teks;
  };

  return (
    <>
      <style>{WR_CSS}</style>
      {/* Filter + aksi */}
      <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '.75rem', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--wr-txt-muted)' }} />
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari objective / strategi / PIC…"
            className="wr-ctl" style={{ ...kontrol, paddingLeft: '2rem', width: 260, maxWidth: '100%' }} />
        </div>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'SEMUA' | Status)} className="wr-ctl" style={kontrol}>
          <option value="SEMUA">Semua Status</option>
          <option value="tercapai">Tercapai</option>
          <option value="dibawah">Di bawah target</option>
          <option value="belum">Belum ada data</option>
        </select>

        <div style={{ flex: 1 }} />

        {isSuperAdmin && (
          <>
            <button type="button" className="wr-btn wr-btn--info" onClick={() => setPanelSumberTerbuka((v) => !v)}
              style={tombol}>
              <Link2 size={15} /> Sumber Sheet
            </button>
            <button type="button" className="wr-btn wr-btn--primary" onClick={sinkronkan} disabled={menyinkron || !source}
              title={source ? 'Tarik ulang dari Google Spreadsheet' : 'Atur sumber sheet terlebih dahulu'}
              style={{ ...tombol, padding: '.5rem .95rem', cursor: source ? 'pointer' : 'not-allowed', opacity: source ? 1 : .5 }}>
              {menyinkron ? <Loader2 size={15} /> : <RefreshCw size={15} />} Sync Sekarang
            </button>
          </>
        )}
      </div>

      {isSuperAdmin && panelSumberTerbuka && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '1.1rem 1.25rem', marginBottom: '1rem', display: 'grid', gap: '.75rem' }}>
          <label style={{ fontSize: '.78rem', color: 'var(--wr-txt-muted)' }}>
            Link Google Spreadsheet tab Work Target (mis. tab "WT 26")
            <input value={urlSheet} onChange={(e) => setUrlSheet(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..."
              className="wr-ctl" style={{ ...kontrol, display: 'block', width: '100%', marginTop: '.35rem' }} />
          </label>
          <div style={{ fontSize: '.72rem', color: 'var(--wr-txt-muted)' }}>
            Klik tab "WT 26" dulu di Google Sheets, lalu copy URL dari address bar (ada <code>?gid=...</code> di belakangnya) —
            gid dibaca otomatis, tidak perlu ketik nama tab. Sheet harus dibagikan sebagai <strong>Anyone with the link — Viewer</strong>.
            Data ini berlaku untuk <strong>seluruh site</strong> (satu sheet untuk seluruh perusahaan). Disinkronkan otomatis tiap 5 menit.
            {source?.lastSyncAt && <> Sync terakhir: {new Date(source.lastSyncAt).toLocaleString('id-ID')} ({source.lastStatus}).</>}
          </div>
          <div>
            <button type="button" className="wr-btn wr-btn--primary" onClick={simpanSumber}
              style={{ padding: '.5rem 1rem', borderRadius: 10, cursor: 'pointer' }}>
              Simpan Sumber
            </button>
          </div>
        </div>
      )}

      {pesan && (
        <div role={pesan.tipe === 'ok' ? 'status' : 'alert'} style={{
          display: 'flex', gap: '.55rem', alignItems: 'flex-start', padding: '.7rem 1rem', borderRadius: 12, marginBottom: '1rem', fontSize: '.8rem',
          whiteSpace: 'pre-wrap',
          background: (pesan.tipe === 'ok' ? NADA.in : NADA.neg).bg,
          border: `1px solid ${(pesan.tipe === 'ok' ? NADA.in : NADA.neg).garis}`,
          color: (pesan.tipe === 'ok' ? NADA.in : NADA.neg).teks,
        }}>
          {pesan.tipe === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{pesan.teks}</span>
        </div>
      )}

      {memuat && (
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', padding: '2rem', color: 'var(--wr-txt-muted)' }}>
          <Loader2 size={16} /> Memuat Work Target…
        </div>
      )}

      {kosong && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '2rem', textAlign: 'center', color: 'var(--wr-txt-muted)', fontSize: '.85rem' }}>
          Belum ada data Work Target.{' '}
          {isSuperAdmin
            ? 'Klik "Sumber Sheet", tempel link tab "WT 26", simpan, lalu "Sync Sekarang".'
            : 'Hubungi Super Admin untuk mengatur sumber sheet-nya.'}
        </div>
      )}

      {!memuat && !kosong && (
        <>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <KartuKpi ikon={Target} nada={NADA.info} label="Work Target" nilai={String(ringkasan.objektif)}
              sub={`${ringkasan.baris} strategi/guideline`} />
            <KartuKpi ikon={Gauge} nada={NADA.out} label="Rata-rata Capaian"
              nilai={ringkasan.rataCapaian === null ? '-' : `${ringkasan.rataCapaian.toFixed(1)}%`}
              sub={`dari ${ringkasan.nCapaian} baris yang sudah ada capaian`} />
            <KartuKpi ikon={TrendingUp} nada={NADA.in} label="Tercapai" nilai={String(ringkasan.hitung.tercapai)}
              sub="capaian terakhir ≥ target" />
            <KartuKpi ikon={ListChecks} nada={NADA.neg} label="Di Bawah Target" nilai={String(ringkasan.hitung.dibawah)}
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
                    <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                    <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: W['--wr-txt-muted'] }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: W['--wr-txt-muted'] }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip {...tooltipProps} formatter={(v: unknown) => `${v}%`} cursor={{ stroke: W['--wr-cursor'] }} />
                    <ReferenceLine y={100} stroke={W['--wr-in']} strokeOpacity={0.7} strokeDasharray="4 4" label={{ value: 'Target 100%', fill: W['--wr-in-text'], fontSize: 11, position: 'insideTopRight' }} />
                    <Line type="monotone" dataKey="Rata-rata Capaian" stroke={W['--wr-out']} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--txt-primary)', margin: '0 0 .6rem .2rem' }}>
            Grafik per Work Target — siapa yang sudah lock target, siapa yang belum
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
            {grupSemua.map((g) => <PanelObjective key={g.key} g={g} bulan={bulanTampil} tema={tema} />)}
          </div>

          <div className="glass-panel" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="simple-table wr-tbl" style={{ minWidth: 900 + bulanTampil.length * 60, borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '.55rem .7rem', textAlign: 'left', fontSize: '.7rem' }}>STRATEGI / GUIDELINE</th>
                    <th style={{ padding: '.55rem .7rem', textAlign: 'left', fontSize: '.7rem' }}>PIC</th>
                    <th style={{ padding: '.55rem .7rem', textAlign: 'right', fontSize: '.7rem' }}>TARGET</th>
                    {bulanTampil.map((b) => (
                      <th key={b} style={{ padding: '.55rem .5rem', textAlign: 'right', fontSize: '.7rem' }}>{b.toUpperCase()}</th>
                    ))}
                    <th style={{ padding: '.55rem .7rem', textAlign: 'left', fontSize: '.7rem' }}>STATUS</th>
                    <th style={{ padding: '.55rem .7rem', textAlign: 'left', fontSize: '.7rem' }}>KETERANGAN</th>
                  </tr>
                </thead>
                <tbody>
                  {grup.map((g) => (
                    <Fragment key={`${g.no}|${g.objective}`}>
                      <tr>
                        <td colSpan={kolomTotal} style={{ padding: '.6rem .7rem', background: NADA.info.bg, borderTop: '1px solid var(--wr-line)', borderLeft: `3px solid ${NADA.info.warna}` }}>
                          <div style={{ fontSize: '.8rem', fontWeight: 700, color: NADA.info.teks }}>
                            {g.no ? `${g.no}. ` : ''}{g.objective}
                          </div>
                          {g.activity && (
                            <div style={{ fontSize: '.72rem', color: 'var(--wr-txt-muted)', marginTop: '.15rem' }}>
                              Activity: {g.activity}
                            </div>
                          )}
                        </td>
                      </tr>
                      {g.baris.map((it) => {
                        const st = statusItem(it);
                        const n = NADA_STATUS[st];
                        const IkonSt = IKON_STATUS[st];
                        return (
                          <tr key={it.id} className="wr-row">
                            <td style={{ padding: '.45rem .7rem', fontSize: '.76rem', color: 'var(--txt-primary)' }}>{it.strategi}</td>
                            <td style={{ padding: '.45rem .7rem', fontSize: '.74rem', color: it.pic.toLowerCase() === 'vacant' ? NADA.warn.teks : 'var(--wr-txt-muted)', whiteSpace: 'nowrap' }}>{it.pic || '-'}</td>
                            <td style={{ padding: '.45rem .7rem', fontSize: '.74rem', textAlign: 'right', color: 'var(--wr-txt-muted)' }}>{it.targetRaw || '-'}</td>
                            {bulanTampil.map((b) => (
                              <td key={b} style={{ padding: '.45rem .5rem', fontSize: '.74rem', textAlign: 'right', fontWeight: 600, color: warnaSel(it.pencapaian[b], it.targetAngka) }}>
                                {it.pencapaian[b] || '-'}
                              </td>
                            ))}
                            <td style={{ padding: '.45rem .7rem', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '.3rem', padding: '.15rem .55rem', borderRadius: 999,
                                fontSize: '.68rem', fontWeight: 600, color: n.teks, background: n.bg, border: `1px solid ${n.garis}`,
                              }}>
                                <IkonSt size={11} aria-hidden="true" />
                                {LABEL_STATUS[st]}
                              </span>
                            </td>
                            <td style={{ padding: '.45rem .7rem', fontSize: '.72rem', color: 'var(--wr-txt-muted)' }}>{it.keterangan || '-'}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                  {!grup.length && (
                    <tr><td colSpan={kolomTotal} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--wr-txt-muted)', fontSize: '.78rem' }}>
                      Tidak ada baris yang cocok dengan filter.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.25rem', marginTop: '1rem', fontSize: '.78rem', color: 'var(--wr-txt-muted)', lineHeight: 1.7 }}>
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