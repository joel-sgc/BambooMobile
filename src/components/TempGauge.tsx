import { useState, useEffect, useRef } from 'react';

export default function TempGauge({
  icon,
  actual,
  target,
  onSet,
  max = 300,
}: {
  icon: React.ReactNode;
  actual: number;
  target: number;
  onSet: (temp: number) => void;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(Math.round(target)));
  const lastSubmitRef = useRef(0);

  useEffect(() => {
    if (!open) setDraft(String(Math.round(target)));
  }, [target, open]);

  function submit() {
    const val = Number(draft);
    if (!draft || isNaN(val)) return;
    const now = Date.now();
    if (now - lastSubmitRef.current < 3000) return;
    lastSubmitRef.current = now;
    onSet(Math.min(max, Math.max(0, val)));
    setOpen(false);
  }

  return (
    <>
      <button
        className='flex flex-col items-center justify-center gap-4 group'
        onClick={() => setOpen(true)}>
        <div className='text-zinc-500 group-hover:text-white transition-colors'>
          {icon}
        </div>
        <div className='text-center'>
          <span className='text-white text-xl font-bold tabular-nums'>
            {Math.round(actual)}
          </span>
          <span className='text-zinc-400 text-sm'>°C</span>
          {target > 0 && (
            <p className='text-zinc-500 text-xs mt-0.5'>→ {Math.round(target)}°C</p>
          )}
        </div>
      </button>

      {open && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/60'
          onClick={() => setOpen(false)}>
          <div
            className='bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl p-5 w-64 mx-4'
            onClick={(e) => e.stopPropagation()}>
            <p className='text-zinc-400 text-sm mb-3'>Set temperature</p>
            <div className='flex items-center gap-2'>
              <input
                type='number'
                inputMode='numeric'
                value={draft}
                min={0}
                max={max}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                className='flex-1 bg-zinc-700 text-white rounded-lg px-3 py-2.5 text-base font-medium min-w-0'
                autoFocus
              />
              <span className='text-zinc-400 text-sm shrink-0'>°C</span>
            </div>
            <div className='flex gap-2 mt-3'>
              <button
                onClick={() => setOpen(false)}
                className='flex-1 py-2.5 rounded-xl bg-zinc-700 text-zinc-200 text-sm font-medium'>
                Cancel
              </button>
              <button
                onClick={submit}
                className='flex-1 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium'>
                Set
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
