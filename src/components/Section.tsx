import { useState } from 'react';

export default function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className='rounded-xl overflow-hidden'>
      <button
        onClick={() => setOpen((o) => !o)}
        className='w-full flex items-center justify-between px-4 py-3 bg-zinc-800 text-left'>
        <span className='text-white font-semibold text-sm'>{title}</span>
        <svg
          className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
          strokeWidth={2}>
          <path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7' />
        </svg>
      </button>
      {open && (
        <div className='bg-zinc-900 px-4 py-4 flex flex-col gap-4'>{children}</div>
      )}
    </div>
  );
}
