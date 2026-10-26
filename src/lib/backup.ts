/* Respaldo: archivo .json con todos los datos de una persona. */
import { BACKUP_APP_ID, findUser } from './constants';
import type { AppState } from './types';

export function backupPayload(user: string, s: AppState) {
  return { app: BACKUP_APP_ID, user: user, exportedAt: new Date().toISOString(), state: s };
}

export interface ParsedBackup { state: any; user: string | null; exportedAt: string | null; }

/* Acepta el respaldo de la app ({app, user, state}) o el estado "crudo" bajado por consola. */
export function parseBackup(text: string, currentUser: string): ParsedBackup | { error: string } {
  let obj: any;
  try { obj = JSON.parse(text); } catch (e) { return { error: 'El archivo no es un respaldo válido.' }; }
  let raw = obj, user: string | null = null, exportedAt: string | null = null;
  if (obj && obj.app === BACKUP_APP_ID) { raw = obj.state; user = obj.user || null; exportedAt = obj.exportedAt || null; }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.transactions) || !Array.isArray(raw.accounts)) return { error: 'El archivo no es un respaldo válido.' };
  if (user && user !== currentUser) { const u = findUser(user); return { error: 'Este respaldo es de ' + (u ? u.name : user) + ', no se puede cargar aquí.' }; }
  return { state: raw, user: user, exportedAt: exportedAt };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
