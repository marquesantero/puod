interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}

export default function PageHeader({ eyebrow, title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute -left-20 -top-16 h-56 w-56 rounded-full bg-emerald-400/30 blur-3xl" />
        <div className="absolute right-8 top-10 h-40 w-40 rounded-full bg-amber-400/40 blur-3xl" />
      </div>
      <div className="relative flex flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-300">{eyebrow}</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{title}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
        </div>
        {children && (
          <div className="flex flex-wrap gap-2">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
