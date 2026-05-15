export default function Section({
  children,
  icon,
}: {
  className?: string;
  children: React.ReactNode;

  icon?: React.ReactNode;
}) {
  return (
    <div className='grid grid-cols-[auto_2px_1fr] gap-4 p-4'>
      {icon}

      <div className='h-full w-0.5 bg-zinc-600' />

      <div className='flex gap-4 w-full'>{children}</div>
    </div>
  );
}
