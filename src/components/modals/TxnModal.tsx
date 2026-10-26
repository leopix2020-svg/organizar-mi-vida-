/* Nuevo movimiento, con la gestión de categorías dentro (el borrador no se pierde al ir y volver). */
import { useState } from 'react';
import { dateOutOfMonthMsg } from '../../actions';
import { CATEGORY_COLOR_PALETTE } from '../../lib/constants';
import { accountBalance, addCategory, catList, deleteCategory, findAccount, updateCategory } from '../../lib/finance';
import { fmt, isInMonth } from '../../lib/format';
import { uid } from '../../lib/state';
import type { AppState, TxnType } from '../../lib/types';
import { askConfirm, clearConfirm, closeModal, commit, getStore, showToast, type Ui } from '../../store';
import { AccountOptions, DateField, Sheet, defaultPeriodDate } from './common';

/* Se recuerdan entre aperturas, como antes. */
let lastTxnType: TxnType = 'expense';
let lastAccountId: string | null = null;

type View = { kind: 'form' } | { kind: 'manage' } | { kind: 'catForm'; type: TxnType; catId: string | null; returnTo: 'form' | 'manage' };

export function TxnModal({ s, ui }: { s: AppState; ui: Ui }) {
  const [type, setType] = useState<TxnType>(lastTxnType);
  const [cat, setCat] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string>(lastAccountId && findAccount(s, lastAccountId) ? lastAccountId : s.accounts[0].id);
  const [date, setDate] = useState(defaultPeriodDate());
  const [note, setNote] = useState('');
  const [view, setView] = useState<View>({ kind: 'form' });

  const cats = catList(s, type);
  const selectedCat = cat && cats.some(c => c.id === cat) ? cat : cats[0].id;
  const changeType = (t: TxnType) => { setType(t); lastTxnType = t; setCat(null); };
  const changeAccount = (id: string) => { setAccountId(id); lastAccountId = id; };

  async function save() {
    const amt = parseFloat(amount);
    const d = date || defaultPeriodDate();
    if (!amt || amt <= 0) { showToast('Ingresa un monto válido.'); return; }
    if (ui.viewMode === 'mensual' && !isInMonth(d, ui.monthOffset)) { showToast(dateOutOfMonthMsg()); return; }
    if (type === 'expense') {
      const bal = accountBalance(s, accountId);
      if (bal < amt) { const acc = findAccount(s, accountId); showToast('Tu wallet ' + (acc ? acc.name : '') + ' solo tiene ' + fmt(s, bal) + ' disponibles.'); return; }
    }
    closeModal();
    await commit(st => { st.transactions.push({ id: uid(), type: type, amount: amt, category: selectedCat, date: d, note: note.trim(), createdAt: Date.now(), accountId: accountId }); });
    showToast('Movimiento guardado.');
  }

  if (view.kind === 'manage') {
    return <CatManage s={s} ui={ui} type={type} onBack={() => setView({ kind: 'form' })} onEdit={(catId) => setView({ kind: 'catForm', type: type, catId: catId, returnTo: 'manage' })} />;
  }
  if (view.kind === 'catForm') {
    const back = () => setView({ kind: view.returnTo === 'manage' ? 'manage' : 'form' });
    return <CatForm s={s} type={view.type} catId={view.catId} onBack={back} onSaved={(newId) => {
      if (view.returnTo === 'form') { changeType(view.type); setCat(newId); setView({ kind: 'form' }); } else back();
    }} onDeleted={() => { if (view.returnTo === 'form') setCat(null); back(); }} />;
  }

  return (
    <Sheet title="Nuevo movimiento">
      <div className="segmented">
        <button className={type === 'expense' ? 'active expense' : ''} onClick={() => changeType('expense')}>Gasto</button>
        <button className={type === 'income' ? 'active income' : ''} onClick={() => changeType('income')}>Ingreso</button>
      </div>
      <div className="field"><label>Monto</label><input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} autoFocus /></div>
      <div className="field"><label>{type === 'income' ? '¿A qué wallet entra?' : '¿De qué wallet sale?'}</label><select value={accountId} onChange={e => changeAccount(e.target.value)}><AccountOptions s={s} /></select></div>
      <div className="field"><label>Categoría</label><div className="cat-grid">
        {cats.map(c => <button type="button" key={c.id} className={'cat-chip ' + (c.id === selectedCat ? 'selected' : '')} onClick={() => setCat(c.id)}>{c.label}</button>)}
        <button type="button" className="cat-chip" onClick={() => setView({ kind: 'catForm', type: type, catId: null, returnTo: 'form' })}>+ Nueva</button></div>
        <div className="manage-link"><a onClick={() => setView({ kind: 'manage' })}>Editar categorías</a></div></div>
      <DateField value={date} onChange={setDate} />
      <div className="field"><label>Nota (opcional)</label><input type="text" placeholder="Ej. Súper del fin de semana" value={note} onChange={e => setNote(e.target.value)} /></div>
      <button className="btn-primary" onClick={save}>Guardar movimiento</button>
    </Sheet>
  );
}

function CatManage(props: { s: AppState; ui: Ui; type: TxnType; onBack: () => void; onEdit: (catId: string | null) => void }) {
  const { s, ui, type } = props;
  async function confirmDelete(id: string) {
    clearConfirm('cat');
    await commit(st => { deleteCategory(st, type, id); });
    showToast('Categoría eliminada.');
  }
  return (
    <Sheet centered title={'Categorías de ' + (type === 'income' ? 'ingreso' : 'gasto')} onClose={props.onBack}>
      {catList(s, type).map(c => (
        <div className="debt-row" style={{ padding: '9px 10px' }} key={c.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="dot" style={{ background: c.color }}></span><span style={{ fontSize: 13.5 }}>{c.label}</span></div>
          <div className="debt-actions">
            <button className="btn-small" onClick={() => props.onEdit(c.id)}>Editar</button>
            {ui.confirm.cat === c.id ?
              <button className="btn-small danger" onClick={() => confirmDelete(c.id)}>Sí</button> :
              <button className="btn-small danger" onClick={() => askConfirm('cat', c.id)}>×</button>}
          </div>
        </div>
      ))}
      <button className="btn-small" style={{ marginTop: 6, width: '100%' }} onClick={() => props.onEdit(null)}>+ Nueva categoría de {type === 'income' ? 'ingreso' : 'gasto'}</button>
    </Sheet>
  );
}

function CatForm(props: { s: AppState; type: TxnType; catId: string | null; onBack: () => void; onSaved: (id: string) => void; onDeleted: () => void }) {
  const { s, type, catId } = props;
  const existing = catId ? catList(s, type).find(c => c.id === catId) || null : null;
  const [name, setName] = useState(existing ? existing.label : '');
  const [color, setColor] = useState(existing ? existing.color : CATEGORY_COLOR_PALETTE[0]);
  async function save() {
    const label = name.trim();
    if (!label) { showToast('Dale un nombre a la categoría.'); return; }
    let newId = catId || '';
    await commit(st => { if (catId) updateCategory(st, type, catId, label, color); else newId = addCategory(st, type, label, color); });
    props.onSaved(newId);
    showToast('Categoría guardada.');
  }
  async function remove() {
    const state = getStore().state;
    if (!state || catList(state, type).length <= 1) { showToast('Debes dejar al menos una categoría.'); return; }
    await commit(st => { deleteCategory(st, type, catId as string); });
    props.onDeleted();
    showToast('Categoría eliminada.');
  }
  return (
    <Sheet centered title={existing ? 'Editar categoría' : 'Nueva categoría'} onClose={props.onBack}>
      <div className="field"><label>Nombre</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Mascotas" autoFocus /></div>
      <div className="field"><label>Color</label><div className="cat-grid">
        {CATEGORY_COLOR_PALETTE.map(c => <button type="button" key={c} onClick={() => setColor(c)} style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: '2px solid ' + (color === c ? 'var(--text)' : 'transparent'), padding: 0 }}></button>)}
      </div></div>
      <button className="btn-primary" onClick={save}>{existing ? 'Guardar cambios' : 'Crear categoría'}</button>
      {existing && <button className="btn-text" style={{ color: 'var(--spend)' }} onClick={remove}>Eliminar categoría</button>}
    </Sheet>
  );
}
