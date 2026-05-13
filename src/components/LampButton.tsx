export default function LampButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`bg-zinc-800 rounded-xl p-4 flex flex-col gap-1 items-start w-full transition-colors ${
        on ? 'ring-1 ring-yellow-500/60' : ''
      }`}>
      <span className='text-zinc-400 text-xs uppercase tracking-wider'>Light</span>
      <span className='text-2xl leading-none mt-1'>{on ? '💡' : '🔦'}</span>
      <span className={`text-xs font-semibold mt-1 ${on ? 'text-yellow-400' : 'text-zinc-500'}`}>
        {on ? 'On' : 'Off'}
      </span>
    </button>
  );
}
