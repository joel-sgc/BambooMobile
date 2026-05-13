export default function TempGauge({
  label,
  actual,
  target,
}: {
  label: string;
  actual: number;
  target?: number;
}) {
  return (
    <div className='bg-zinc-800 rounded-xl p-4 flex flex-col gap-1'>
      <span className='text-zinc-400 text-xs uppercase tracking-wider'>{label}</span>
      <span className='text-white text-2xl font-bold tabular-nums'>{actual.toFixed(1)}°</span>
      {target != null && target > 0 && (
        <span className='text-zinc-500 text-xs'>target {target.toFixed(0)}°</span>
      )}
    </div>
  );
}
