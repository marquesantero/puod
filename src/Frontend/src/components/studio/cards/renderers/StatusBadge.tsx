/** Badge visual de status reutilizado por todos os renderers de tabela. */
export function StatusBadge({ status }: { status: any }) {
  const statusStr = String(status).toLowerCase();

  let bgColor = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
  let dotColor = "bg-slate-400";

  if (statusStr === "success" || statusStr === "succeeded") {
    bgColor = "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400";
    dotColor = "bg-emerald-500";
  } else if (statusStr === "failed" || statusStr === "failure" || statusStr === "error") {
    bgColor = "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
    dotColor = "bg-red-500";
  } else if (statusStr === "running" || statusStr === "in_progress") {
    bgColor = "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400";
    dotColor = "bg-blue-500";
  } else if (statusStr === "queued" || statusStr === "pending") {
    bgColor = "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
    dotColor = "bg-amber-500";
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium ${bgColor}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {status}
    </div>
  );
}
