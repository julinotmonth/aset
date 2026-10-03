// Akses menu portal admin. Menu yang TIDAK ada di daftar ini terkunci
// (sedang dalam pengembangan): di sidebar tampil dengan ikon gembok dan
// tidak bisa dibuka — baik dari klik sidebar maupun dari jalur lain
// (Global Search, notifikasi), karena AdminDashboard memfilter semua
// perpindahan lewat menuTerbuka().
//
// Untuk membuka kunci sebuah menu, cukup tambahkan id-nya ke MENU_TERBUKA.
import type { AdminView } from './Sidebar';

export const MENU_TERBUKA: AdminView[] = ['weekly-report'];

/** Halaman yang dibuka pertama kali setelah login. Harus menu yang terbuka. */
export const MENU_AWAL: AdminView = 'weekly-report';

export const menuTerbuka = (view: AdminView): boolean => MENU_TERBUKA.includes(view);