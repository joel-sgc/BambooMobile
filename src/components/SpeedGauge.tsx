import { useState } from 'react';

const SPEED_LEVELS = ['', 'Silent', 'Standard', 'Sport', 'Ludicrous'] as const;

export default function SpeedGauge({
  level,
  onSet,
  icon,
}: {
  level: number;
  onSet: (lvl: number) => void;
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const safe = Math.min(4, Math.max(1, level || 2));

  return (
    <>
      <button
        className='flex flex-col items-center justify-center gap-4 group'
        onClick={() => setOpen(true)}>
        <div className='text-zinc-500 group-hover:text-white transition-colors'>
          {icon}
        </div>
        <span className='text-white text-sm font-bold'>{SPEED_LEVELS[safe]}</span>
      </button>

      {open && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/60'
          onClick={() => setOpen(false)}>
          <div
            className='bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl p-5 w-80 mx-4'
            onClick={(e) => e.stopPropagation()}>
            <div className='flex items-center justify-between mb-4'>
              <span className='text-zinc-400 text-sm'>Speed Mode</span>
              <span className='text-white text-base font-semibold'>
                {SPEED_LEVELS[safe]}
              </span>
            </div>
            <input
              type='range'
              min={1}
              max={4}
              step={1}
              value={safe}
              onChange={(e) => onSet(Number(e.target.value))}
              className='w-full accent-teal-500 h-2'
            />
            <div className='flex justify-between text-zinc-500 text-xs mt-2'>
              {SPEED_LEVELS.slice(1).map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
            <button
              onClick={() => setOpen(false)}
              className='w-full mt-4 py-2.5 rounded-xl bg-zinc-700 text-zinc-200 text-sm font-medium'>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
