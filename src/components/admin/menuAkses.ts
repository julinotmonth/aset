// Akses menu portal admin. Menu yang TIDAK ada di daftar ini terkunci
// (sedang dalam pengembangan): di sidebar tampil dengan ikon gembok dan
// tidak bisa dibuka — baik dari klik sidebar maupun dari jalur lain
// (Global Search, notifikasi), karena AdminDashboard memfilter semua
// perpindahan lewat menuTerbuka().
//
// Untuk membuka kunci sebuah menu, cukup tambahkan id-nya ke MENU_TERBUKA.
import type { AdminView } from './Sidebar';

export const MENU_TERBUKA: AdminView[] = ['weekly-report', 'asset-registry', 'assets', 'assignments', 'work-orders'];

/** Halaman yang dibuka pertama kali setelah login. Harus menu yang terbuka. */
export const MENU_AWAL: AdminView = 'weekly-report';

/**
 * Menu yang DISEMBUNYIKAN dari sidebar (tidak tampil sama sekali, bukan
 * sekadar bergembok). Untuk memunculkannya lagi, hapus id-nya dari daftar ini.
 * Menu ini tetap terkunci lewat MENU_TERBUKA, jadi tidak bisa dibuka dari jalur lain.
 */
export const MENU_DISEMBUNYIKAN: AdminView[] = ['reports', 'categories', 'maintenance', 'audit', 'product-lines'];

export const menuTerbuka = (view: AdminView): boolean => MENU_TERBUKA.includes(view);