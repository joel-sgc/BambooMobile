export type Page = 'dashboard' | 'files' | 'timelapses' | 'printer-settings';

const NAV = [
  {
    page: 'dashboard' as Page,
    label: 'Dashboard',
    icon: (
      <svg
        className='w-5 h-5'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
        strokeWidth={1.75}>
        <rect x='3' y='3' width='7' height='7' rx='1' />
        <rect x='14' y='3' width='7' height='7' rx='1' />
        <rect x='3' y='14' width='7' height='7' rx='1' />
        <rect x='14' y='14' width='7' height='7' rx='1' />
      </svg>
    ),
  },
  {
    page: 'files' as Page,
    label: 'File Manager',
    icon: (
      <svg
        className='w-5 h-5'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
        strokeWidth={1.75}>
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          d='M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z'
        />
      </svg>
    ),
  },
  {
    page: 'timelapses' as Page,
    label: 'Timelapses',
    icon: (
      <svg
        className='w-5 h-5'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
        strokeWidth={1.75}>
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          d='M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
        />
      </svg>
    ),
  },
  {
    page: 'printer-settings' as Page,
    label: 'Printer Settings',
    icon: (
      <svg
        className='w-5 h-5'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
        strokeWidth={1.75}>
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
        />
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
        />
      </svg>
    ),
  },
] as const;

export default function Sidebar({
  open,
  onClose,
  page,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  page: Page;
  onNavigate: (p: Page) => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          open ?
            'opacity-100 pointer-events-auto'
          : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-64 bg-zinc-900 border-l border-zinc-800 z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className='flex items-center justify-between px-5 py-4 border-b border-zinc-800'>
          <span className='text-white font-semibold'>BambooMobile</span>
          <button
            onClick={onClose}
            className='text-zinc-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center'>
            <svg
              className='w-5 h-5'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              strokeWidth={2}>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        <nav className='flex flex-col p-3 gap-1 flex-1'>
          {NAV.map((item) => (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                page === item.page ?
                  'bg-teal-900/50 text-teal-400'
                : 'text-zinc-300 hover:bg-zinc-800'
              }`}>
              {item.icon}
              <span className='font-medium text-sm'>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
