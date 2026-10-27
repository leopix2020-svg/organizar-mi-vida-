/* Modal de Comidas: anotar o editar un día (lo comido, quemadas, comidas y metas). */
import { useState } from 'react';
import { MACROS, MEALS, findDay, lastGoal, mealsTotal, upsertDay } from '../../lib/nutrition';
import { todayStr } from '../../lib/format';
import { uid } from '../../lib/state';
import type { AppState, Macros, MealKey } from '../../lib/types';
import { closeModal, commit, setUi, showToast } from '../../store';
import { Sheet } from './common';

type Draft = Record<string, string>;
const str = (n: number | undefined) => (n ? String(n) : '');
const val = (v: string) => { const n = parseFloat(v); return n > 0 ? Math.round(n) : 0; };

function NumField({ label, value, onChange, unit }: { label: string; value: string; onChange: (v: string) => void; unit: string }) {
  return <div className="field"><label>{label}</label><input type="number" inputMode="numeric" min="0" step="1" placeholder={unit} value={value} onChange={e => onChange(e.target.value)} /></div>;
}

export function NutritionDayModal({ s, date }: { s: AppState; date: string | null }) {
  const existing = findDay(s, date || todayStr());
  const goal = existing ? existing.goal : lastGoal(s);
  const [day, setDay] = useState(existing ? existing.date : (date || todayStr()));
  const [eaten, setEaten] = useState<Draft>({ kcal: str(existing?.eaten.kcal), carbs: str(existing?.eaten.carbs), protein: str(existing?.eaten.protein), fat: str(existing?.eaten.fat) });
  const [burned, setBurned] = useState(str(existing?.burned));
  const [meals, setMeals] = useState<Draft>({ breakfast: str(existing?.meals.breakfast), lunch: str(existing?.meals.lunch), dinner: str(existing?.meals.dinner), snacks: str(existing?.meals.snacks) });
  const [goals, setGoals] = useState<Draft>({ kcal: str(goal?.kcal), carbs: str(goal?.carbs), protein: str(goal?.protein), fat: str(goal?.fat) });

  /* Si anotas las comidas, las calorías del día se calculan solas (y las puedes corregir). */
  function changeMeal(k: MealKey, v: string) {
    const next = Object.assign({}, meals, { [k]: v });
    setMeals(next);
    const sum = mealsTotal({ breakfast: val(next.breakfast), lunch: val(next.lunch), dinner: val(next.dinner), snacks: val(next.snacks) });
    if (sum > 0) setEaten(Object.assign({}, eaten, { kcal: String(sum) }));
  }
  const toMacros = (d: Draft): Macros => ({ kcal: val(d.kcal), carbs: val(d.carbs), protein: val(d.protein), fat: val(d.fat) });

  async function save() {
    if (!day || day > todayStr()) { showToast('Elige una fecha de hoy o anterior.'); return; }
    const e = toMacros(eaten), g = toMacros(goals);
    if (e.kcal <= 0) { showToast('Anota las calorías que comiste.'); return; }
    if (g.kcal <= 0) { showToast('Anota tu meta de calorías.'); return; }
    const replacing = existing ? existing.id : null;
    const overwrites = day !== (existing ? existing.date : '') && !!findDay(s, day);
    closeModal();
    await commit(st => upsertDay(st, {
      id: existing ? existing.id : uid(), date: day, eaten: e, goal: g, burned: val(burned),
      meals: { breakfast: val(meals.breakfast), lunch: val(meals.lunch), dinner: val(meals.dinner), snacks: val(meals.snacks) },
      createdAt: existing ? existing.createdAt : Date.now()
    }, replacing));
    setUi({ nutDate: day });
    showToast(overwrites ? 'Ese día ya tenía registro: se reemplazó.' : existing ? 'Día actualizado.' : 'Día guardado.');
  }

  return (
    <Sheet title={existing ? 'Editar día' : 'Anotar día'}>
      <div className="field"><label>Fecha</label><input type="date" value={day} max={todayStr()} onChange={e => setDay(e.target.value)} /></div>
      <div className="item-name" style={{ fontSize: 14, margin: '4px 0 8px' }}>Comidas</div>
      <div className="macro-grid">
        {MEALS.map(m => <NumField key={m.key} label={m.label} unit="kcal" value={meals[m.key]} onChange={v => changeMeal(m.key, v)} />)}
      </div>
      <div className="item-name" style={{ fontSize: 14, margin: '4px 0 8px' }}>Comido en el día</div>
      <div className="macro-grid">
        <NumField label="Calorías" unit="kcal" value={eaten.kcal} onChange={v => setEaten(Object.assign({}, eaten, { kcal: v }))} />
        <NumField label="Quemadas" unit="kcal" value={burned} onChange={setBurned} />
        {MACROS.map(m => <NumField key={m.key} label={m.label} unit="g" value={eaten[m.key]} onChange={v => setEaten(Object.assign({}, eaten, { [m.key]: v }))} />)}
      </div>
      <div className="item-name" style={{ fontSize: 14, margin: '4px 0 8px' }}>Metas</div>
      <div className="field-hint" style={{ marginTop: 0, marginBottom: 8 }}>{goal ? 'Copiadas de tu último día; cámbialas si tu meta cambió.' : 'Pon tus metas una vez; los días siguientes se copian solas.'}</div>
      <div className="macro-grid">
        <NumField label="Calorías" unit="kcal" value={goals.kcal} onChange={v => setGoals(Object.assign({}, goals, { kcal: v }))} />
        {MACROS.map(m => <NumField key={m.key} label={m.label} unit="g" value={goals[m.key]} onChange={v => setGoals(Object.assign({}, goals, { [m.key]: v }))} />)}
      </div>
      <button className="btn-primary" onClick={save}>{existing ? 'Guardar cambios' : 'Guardar día'}</button>
    </Sheet>
  );
}
