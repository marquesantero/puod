import * as React from "react";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={[
        "flex h-9 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground",
        "dark:bg-slate-950/60 dark:text-slate-100 dark:border-slate-700",
        "placeholder:text-muted-foreground focus:outline-none",
        "focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  )
);

Input.displayName = "Input";
