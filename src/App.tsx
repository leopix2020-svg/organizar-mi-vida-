import { useEffect, useState } from 'react';
import * as A from './actions';
import { boot, selectUser, showUserPicker, submitLock } from './api/client';
import { BolsaSection } from './components/BolsaSection';
import { EjercicioSection } from './components/EjercicioSection';
import { FinanzasView } from './components/Finanzas';
import { Toast, useTooltips } from './components/Overlays';
import { ModalRoot } from './components/modals/ModalRoot';
import { FINANZAS_TABS, USERS, findUser } from './lib/constants';
import { walletCurrencyGroups } from './lib/finance';
import { greetingText, monthLabel } from './lib/format';
import type { AppState } from './lib/types';
import { openModal, setUi, useStore, type Ui } from './store';

function useIsDesktop() {
  const query = () => window.matchMedia('(min-width:880px)').matches;
  const [desktop, setDesktop] = useState(query);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(timer); timer = setTimeout(() => setDesktop(query()), 150); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return desktop;
}

/* ---- Pantallas de entrada ---- */
function UserPicker() {
  return (
    <div className="lock-root" style={{ display: 'flex' }}><div className="lock-card">
      <div className="lock-title">Mi Vida Organizada</div>
      <div className="lock-sub">¿Quién eres?</div>
      <div className="user-picker">
        {USERS.map(u => <button className="btn-user" type="button" key={u.id} onClick={() => selectUser(u.id)}>{u.name}</button>)}
      </div>
    </div></div>
  );
}
function LockScreen({ userId, error }: { userId: string; error?: string }) {
  const [value, setValue] = useState('');
  const user = findUser(userId);
  const name = user ? user.name : '';
  const submit = () => { const v = value.trim(); if (v) void submitLock(userId, v); };
  return (
    <div className="lock-root" style={{ display: 'flex' }}><div className="lock-card">
      <div className="lock-title">Mi Vida Organizada</div>
      <div className="lock-sub">Clave de {name}</div>
      {error && <div className="lock-error">{error}</div>}
      <input type="password" className="lock-input" placeholder="Tu clave" autoComplete="off" autoFocus value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
      <button className="btn-primary" type="button" onClick={submit}>Entrar</button>
      <button className="btn-text lock-back" type="button" onClick={showUserPicker}>No soy {name}</button>
    </div></div>
  );
}
function LoadError() {
  return (
    <div className="lock-root" style={{ display: 'flex' }}><div className="lock-card">
      <div className="lock-title">Mi Vida Organizada</div>
      <div className="lock-sub">No se pudieron cargar tus datos. Para no arriesgar nada, la app no abre hasta que carguen bien.</div>
      <button className="btn-primary" id="load-retry" type="button" onClick={() => void boot()}>Reintentar</button>
      <button className="btn-text lock-back" type="button" onClick={showUserPicker}>Cambiar de usuario</button>
    </div></div>
  );
}

/* ---- App ---- */
const RAIL_ICONS: Record<string, JSX.Element> = {
  finanzas: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20" /><circle cx="17" cy="14.5" r="1.4" fill="currentColor" stroke="none" /></svg>,
  bolsa: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v18M16.5 7.5c0-1.66-2-3-4.5-3S7.5 5.84 7.5 7.5c0 1.66 2 2.5 4.5 3s4.5 1.34 4.5 3-2 3-4.5 3-4.5-1.34-4.5-3" /></svg>,
  ejercicio: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6.5 6.5l11 11M4 9l3-3 2 2-3 3-2-2zM15 18l3-3 2 2-3 3-2-2zM2 2l3 3M19 19l3 3" /></svg>
};

function Rail({ ui }: { ui: Ui }) {
  const go = (section: 'finanzas' | 'bolsa' | 'ejercicio') => setUi(section === 'finanzas' ? { section: section, tab: 'resumen' } : { section: section });
  return (
    <div className="rail" id="rail">
      <button className={ui.section === 'finanzas' ? 'active' : ''} onClick={() => go('finanzas')}><span className="rail-icon-wrap">{RAIL_ICONS.finanzas}</span>Finanzas</button>
      <button className={ui.section === 'bolsa' ? 'active' : ''} onClick={() => go('bolsa')}><span className="rail-icon-wrap">{RAIL_ICONS.bolsa}</span>Bolsa</button>
      <button className={ui.section === 'ejercicio' ? 'active' : ''} onClick={() => go('ejercicio')}><span className="rail-icon-wrap">{RAIL_ICONS.ejercicio}</span>Ejercicio</button>
    </div>
  );
}

function Header({ s, ui, desktop }: { s: AppState; ui: Ui; desktop: boolean }) {
  const inFinanzas = ui.section === 'finanzas';
  const showMonth = inFinanzas && (desktop || ui.tab === 'resumen' || ui.tab === 'movimientos');
  const showCurrencyRow = inFinanzas && (desktop || ui.tab === 'resumen' || ui.tab === 'movimientos' || ui.tab === 'cuentas');
  const groups = walletCurrencyGroups(s);
  const activeCurrency = ui.currencyTab && groups.some(g => g.currency === ui.currencyTab) ? ui.currencyTab : s.currency;
  useEffect(() => { if (ui.currencyTab !== activeCurrency && showCurrencyRow) setUi({ currencyTab: activeCurrency }); });
  return <>
    <header>
      <div className="header-top">
        <div className="greeting">{inFinanzas ? <>{greetingText()}<span>¿Cómo van tus wallets hoy?</span></> : ui.section === 'ejercicio' ? <>Ejercicio<span>Tu rutina, serie por serie</span></> : <>Bolsa<span>Tus acciones reales, con precios de verdad</span></>}</div>
        <button className="icon-btn" aria-label="Ajustes" onClick={() => openModal({ type: 'settings' })}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.36.62 1 .99 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
        </button>
      </div>
      {showCurrencyRow && <div className="currency-row" id="currency-row" style={{ display: 'flex' }}>
        {groups.length > 1 ? <div className="view-toggle">{groups.map(g => <button key={g.currency} className={activeCurrency === g.currency ? 'active' : ''} onClick={() => setUi({ currencyTab: g.currency })}>{g.currency}</button>)}</div> : <div></div>}
        <button className="icon-btn small" title="Agregar wallet en otra moneda" onClick={() => openModal({ type: 'account', accountId: null })}>+</button>
      </div>}
      {showMonth && <div className="month-switch" id="month-row" style={{ display: 'flex' }}>
        <div className="view-toggle">
          <button className={ui.viewMode === 'total' ? 'active' : ''} onClick={() => setUi({ viewMode: 'total' })}>Total</button>
          <button className={ui.viewMode === 'mensual' ? 'active' : ''} onClick={() => setUi({ viewMode: 'mensual' })}>Por mes</button>
        </div>
        {ui.viewMode === 'mensual' && <div className="month-nav"><button className="arrow" onClick={() => setUi({ monthOffset: ui.monthOffset - 1 })}>‹</button><div className="month-label">{monthLabel(ui.monthOffset)}</div><button className="arrow" disabled={ui.monthOffset >= 0} onClick={() => setUi({ monthOffset: Math.min(0, ui.monthOffset + 1) })}>›</button></div>}
      </div>}
    </header>
    {inFinanzas && <nav className="tabs" id="tabs" style={{ display: 'flex' }}>
      {FINANZAS_TABS.map(t => <button key={t.id} className={ui.tab === t.id ? 'active' : ''} onClick={() => setUi({ tab: t.id })}>{t.label}</button>)}
    </nav>}
  </>;
}

export function App() {
  const store = useStore();
  const desktop = useIsDesktop();
  useTooltips();
  const s = store.state;
  const theme = s ? s.theme : null;
  useEffect(() => { if (theme) document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  let content;
  const screen = store.screen;
  if (screen.kind === 'picker') content = <UserPicker />;
  else if (screen.kind === 'lock') content = <LockScreen key={screen.userId + (screen.error || '')} userId={screen.userId} error={screen.error} />;
  else if (screen.kind === 'loadError') content = <LoadError />;
  else if (screen.kind === 'loading' || !s) content = <div className="app-shell" id="app"><div className="app-main"><main id="main-content"><div className="empty-state">Cargando tus datos…</div></main></div></div>;
  else {
    const ui = store.ui;
    content = <>
      <div className="app-shell" id="app">
        <Rail ui={ui} />
        <div className="app-main">
          <Header s={s} ui={ui} desktop={desktop} />
          <main id="main-content">
            {ui.section === 'bolsa' ? <BolsaSection s={s} ui={ui} /> : ui.section === 'ejercicio' ? <EjercicioSection s={s} ui={ui} /> : <FinanzasView s={s} ui={ui} desktop={desktop} />}
          </main>
          {(ui.section === 'finanzas' && !desktop) && <button className="fab" aria-label="Agregar" style={{ display: 'flex' }} onClick={A.fab}>+</button>}
        </div>
      </div>
      <ModalRoot s={s} ui={ui} />
    </>;
  }
  return <>{content}<Toast toast={store.toast} /></>;
}
