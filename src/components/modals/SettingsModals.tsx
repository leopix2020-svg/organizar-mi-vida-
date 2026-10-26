/* Ajustes, borrar datos y respaldo. */
import { useRef, useState } from 'react';
import { logout } from '../../api/client';
import { backupPayload, downloadJson, parseBackup, type ParsedBackup } from '../../lib/backup';
import { CURRENCIES, findUser } from '../../lib/constants';
import { todayStr } from '../../lib/format';
import { defaultState, normalizeState } from '../../lib/state';
import type { AppState } from '../../lib/types';
import { closeModal, commit, getStore, openModal, setStore, showToast } from '../../store';
import { Sheet } from './common';

export function downloadBackup(suffix?: string) {
  const { state, currentUser } = getStore();
  if (!state || !currentUser) return;
  downloadJson('respaldo-' + currentUser + '-' + todayStr() + (suffix ? ('-' + suffix) : '') + '.json', backupPayload(currentUser, state));
}

export function SettingsModal({ s }: { s: AppState }) {
  const [currency, setCurrency] = useState(CURRENCIES[s.currency] ? s.currency : 'OTRO');
  const [symbol, setSymbol] = useState(s.customSymbol || '$');
  const fileRef = useRef<HTMLInputElement>(null);
  async function save() {
    closeModal();
    await commit(st => { st.currency = currency; if (currency === 'OTRO') st.customSymbol = symbol.trim() || '$'; });
    showToast('Ajustes guardados.');
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    file.text().then(text => {
      const parsed = parseBackup(text, getStore().currentUser || '');
      if ('error' in parsed) { showToast(parsed.error); return; }
      openModal({ type: 'restore', parsed: parsed });
    }, () => showToast('No se pudo leer el archivo.'));
  }
  const themeBtn = (theme: 'warm' | 'dark', label: string, style: React.CSSProperties) => (
    <button onClick={() => commit(st => { st.theme = theme; })} style={Object.assign({ flex: 1, padding: 12, borderRadius: 12 }, style, { fontFamily: 'Inter,sans-serif', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' })}>{label}</button>
  );
  return (
    <Sheet centered title="Ajustes">
      <div className="field"><label>Apariencia</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {themeBtn('warm', '☀ Cálido', { border: '2px solid ' + (s.theme === 'warm' ? '#1E2A38' : 'transparent'), background: '#EFEBDD', color: '#1E2A38' })}
          {themeBtn('dark', '● Oscuro', { border: '2px solid ' + (s.theme === 'dark' ? '#4ADE80' : 'transparent'), background: '#0D0D0D', color: '#4ADE80' })}
        </div>
      </div>
      <div className="field"><label>Moneda</label><select value={currency} onChange={e => setCurrency(e.target.value)}>
        {Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}
        <option value="OTRO">Otra (símbolo personalizado)</option>
      </select></div>
      {currency === 'OTRO' && <div className="field"><label>Símbolo personalizado</label><input type="text" maxLength={4} value={symbol} onChange={e => setSymbol(e.target.value)} /></div>}
      <button className="btn-primary" onClick={save}>Guardar ajustes</button>
      <div className="field-hint" style={{ textAlign: 'center', marginTop: 6 }}>Las categorías de gasto e ingreso se editan desde la ventana de "Nuevo movimiento".</div>
      <div className="field" style={{ marginTop: 16 }}><label>Respaldo</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-small" style={{ flex: 1, padding: 10 }} onClick={() => { downloadBackup(); showToast('Respaldo descargado.'); }}>Descargar respaldo</button>
          <button className="btn-small" style={{ flex: 1, padding: 10 }} onClick={() => { if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); } }}>Cargar respaldo</button>
        </div>
        <input type="file" id="backup-file" ref={fileRef} accept=".json,application/json" style={{ display: 'none' }} onChange={onFile} />
        <div className="field-hint">Guarda en un archivo una copia de todos tus datos, o vuelve a cargar una.</div>
      </div>
      <button className="btn-text" style={{ color: 'var(--spend)', marginTop: 10 }} onClick={() => openModal({ type: 'reset' })}>Borrar todos mis datos</button>
      <button className="btn-text" style={{ marginTop: 2 }} onClick={logout}>Cerrar sesión / cambiar de usuario</button>
      <div style={{ fontSize: 11.5, color: 'var(--text-faint)', textAlign: 'center', marginTop: 10 }}>Tus datos se guardan de forma privada. Solo tú puedes verlos con tu clave.</div>
    </Sheet>
  );
}

export function ResetModal() {
  async function doReset() {
    closeModal();
    setStore({ state: defaultState() });
    await commit(() => { /* guarda el estado vacío */ });
    showToast('Tus datos se borraron.');
  }
  return (
    <Sheet centered noClose title="¿Borrar todos tus datos?">
      <p style={{ fontSize: 13.5, color: 'var(--text-soft)', margin: '0 0 18px' }}>Se eliminarán todos tus movimientos, metas, wallets, la bolsa y deudas. Esta acción no se puede deshacer.</p>
      <button className="btn-primary" style={{ background: 'var(--spend)' }} onClick={doReset}>Sí, borrar todo</button>
      <button className="btn-text" onClick={closeModal}>Cancelar</button>
    </Sheet>
  );
}

export function RestoreModal({ parsed }: { parsed: ParsedBackup }) {
  const st = parsed.state;
  const me = findUser(getStore().currentUser);
  const when = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  const summary = (when ? ('Respaldo del ' + when + '. ') : '') + st.transactions.length + ' movimientos, ' + st.accounts.length + ' wallets, ' + (Array.isArray(st.goals) ? st.goals.length : 0) + ' metas y ' + (Array.isArray(st.debts) ? st.debts.length : 0) + ' deudas.';
  async function doRestore() {
    downloadBackup('antes-de-cargar');
    closeModal();
    setStore({ state: normalizeState(parsed.state) });
    await commit(() => { /* guarda el respaldo cargado */ });
    showToast('Respaldo cargado.');
  }
  return (
    <Sheet centered noClose title="¿Cargar este respaldo?">
      <p style={{ fontSize: 13.5, color: 'var(--text-soft)', margin: '0 0 10px' }}>{summary}</p>
      <p style={{ fontSize: 13.5, color: 'var(--text-soft)', margin: '0 0 18px' }}>Esto reemplaza todos tus datos actuales. Antes de cargarlo te descargo una copia de lo que tienes ahora.{!parsed.user ? (' Asegúrate de que este respaldo sea de ' + (me ? me.name : '') + '.') : ''}</p>
      <button className="btn-primary" onClick={doRestore}>Sí, cargar respaldo</button>
      <button className="btn-text" onClick={closeModal}>Cancelar</button>
    </Sheet>
  );
}
