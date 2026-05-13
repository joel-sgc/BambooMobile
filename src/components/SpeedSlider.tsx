const SPEED_LEVELS = ['', 'Silent', 'Standard', 'Sport', 'Ludicrous'] as const;

export default function SpeedSlider({
  level,
  onSet,
}: {
  level: number;
  onSet: (lvl: number) => void;
}) {
  const safe = Math.min(4, Math.max(1, level || 2));
  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between'>
        <span className='text-zinc-400 text-xs'>Speed Mode</span>
        <span className='text-white text-sm font-semibold'>{SPEED_LEVELS[safe]}</span>
      </div>
      <input
        type='range'
        min={1}
        max={4}
        step={1}
        value={safe}
        onChange={(e) => onSet(Number(e.target.value))}
        className='w-full accent-teal-500'
      />
      <div className='flex justify-between text-zinc-600 text-[10px]'>
        {SPEED_LEVELS.slice(1).map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}
