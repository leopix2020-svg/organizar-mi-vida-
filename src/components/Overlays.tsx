/* Aviso flotante (toast) y tooltip de las gráficas. */
import { useEffect, useState } from 'react';

export function Toast({ toast }: { toast: { msg: string; id: number } | null }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(t);
  }, [toast]);
  return <div className={'toast' + (visible ? ' show' : '')} id="toast">{toast ? toast.msg : ''}</div>;
}

/* Cualquier elemento con data-tooltip muestra su texto: al pasar el mouse, o 2,2 s al tocarlo. */
export function useTooltips() {
  useEffect(() => {
    let el: HTMLDivElement | null = null;
    let hideTimer: ReturnType<typeof setTimeout>;
    const ensure = () => { if (!el) { el = document.createElement('div'); el.className = 'chart-tooltip'; document.body.appendChild(el); } return el; };
    const show = (text: string, x: number, y: number) => {
      const t = ensure();
      t.textContent = text;
      t.style.left = (x + 14) + 'px'; t.style.top = (y + 14) + 'px';
      t.classList.add('show');
      const rect = t.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) t.style.left = (x - rect.width - 14) + 'px';
      if (rect.bottom > window.innerHeight - 8) t.style.top = (y - rect.height - 14) + 'px';
    };
    const hide = () => { if (el) el.classList.remove('show'); };
    const target = (e: Event) => (e.target instanceof Element) ? e.target.closest('[data-tooltip]') : null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const t = target(e);
      if (t) show(t.getAttribute('data-tooltip') || '', e.clientX, e.clientY); else hide();
    };
    const onDown = (e: PointerEvent) => {
      const t = target(e);
      if (t && e.pointerType === 'touch') { show(t.getAttribute('data-tooltip') || '', e.clientX, e.clientY); clearTimeout(hideTimer); hideTimer = setTimeout(hide, 2200); }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('scroll', hide, true);
      if (el) el.remove();
    };
  }, []);
}
