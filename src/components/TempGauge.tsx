export default function TempGauge({
  icon,
  actual,
}: {
  icon: React.ReactNode;
  actual: number;
}) {
  return (
    <div className='flex flex-col items-center justify-center gap-4'>
      <span className='text-zinc-500 text-xs uppercase tracking-wider'>
        {icon}
      </span>

      <div>
        <span className='text-white text-xl font-bold tabular-nums'>
          {actual.toFixed(1)}
        </span>
        <span className='text-zinc-400'>°C</span>
      </div>
    </div>
  );
}
