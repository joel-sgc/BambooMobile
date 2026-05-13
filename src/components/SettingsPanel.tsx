export default function SettingsPanel({
  ip,
  setIp,
  accessCode,
  setAccessCode,
  serial,
  setSerial,
  onConnect,
  error,
  onBack,
}: {
  ip: string;
  setIp: (v: string) => void;
  accessCode: string;
  setAccessCode: (v: string) => void;
  serial: string;
  setSerial: (v: string) => void;
  onConnect: () => void;
  error: string;
  onBack?: () => void;
}) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConnect();
  }

  return (
    <div className='min-h-screen bg-zinc-950 text-white flex flex-col'>
      <div
        className='flex items-center px-4 pb-3 bg-zinc-900 border-b border-zinc-800 gap-3'
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
        {onBack && (
          <button
            onClick={onBack}
            className='text-zinc-400 hover:text-white transition-colors text-lg leading-none'>
            ←
          </button>
        )}
        <h1 className='font-semibold text-lg'>Printer Settings</h1>
      </div>

      <div className='flex-1 p-6 flex flex-col gap-4'>
        {error && (
          <div className='bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3'>
            <p className='text-red-400 text-sm font-medium'>Connection failed</p>
            <p className='text-red-500/80 text-xs mt-1'>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          <label className='flex flex-col gap-1'>
            <span className='text-zinc-400 text-xs uppercase tracking-wider'>Printer IP</span>
            <input
              className='bg-zinc-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500'
              placeholder='192.168.1.100'
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              required
            />
          </label>

          <label className='flex flex-col gap-1'>
            <span className='text-zinc-400 text-xs uppercase tracking-wider'>Access Code</span>
            <input
              className='bg-zinc-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest'
              placeholder='12345678'
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              required
            />
          </label>

          <label className='flex flex-col gap-1'>
            <span className='text-zinc-400 text-xs uppercase tracking-wider'>Serial Number</span>
            <input
              className='bg-zinc-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500 font-mono'
              placeholder='01P09C400101231'
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              required
            />
          </label>

          <button
            type='submit'
            className='bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg py-3 transition-colors mt-2'>
            Connect
          </button>
        </form>

        <p className='text-zinc-600 text-xs text-center'>
          Find your access code on the printer touchscreen → Settings → WLAN
        </p>
      </div>
    </div>
  );
}
