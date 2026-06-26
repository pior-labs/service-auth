import type { ChangeEventHandler, ReactNode } from "react";

type LoginFieldProps = {
  id: string;
  label: string;
  type: string;
  value: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "numeric" | "tel" | "url" | "search" | "none";
  placeholder?: string;
  disabled?: boolean;
  trailing?: ReactNode;
  onChange: ChangeEventHandler<HTMLInputElement>;
};

export function LoginField({
  id,
  label,
  type,
  value,
  autoComplete,
  inputMode,
  placeholder,
  disabled,
  trailing,
  onChange,
}: LoginFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-serif text-[11px] uppercase tracking-[0.24em] text-ink-2"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          type={type}
          value={value}
          required
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          disabled={disabled}
          onChange={onChange}
          className="peer w-full min-h-12 rounded-2xl border border-ink/15 bg-frost/65 px-4 py-3 pr-12 font-sans text-[15px] text-ink shadow-[inset_0_1px_0_rgba(var(--frost-rgb),0.6)] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:font-sans placeholder:text-ink-3/70 hover:border-ink/25 hover:bg-frost/80 focus:border-accent/60 focus:bg-frost/95 focus:shadow-[0_0_0_4px_rgba(197,112,74,0.12),inset_0_1px_0_rgba(var(--frost-rgb),0.7)] disabled:cursor-not-allowed disabled:opacity-70"
        />
        {trailing ? (
          <div className="absolute right-1.5 flex items-center justify-center">{trailing}</div>
        ) : null}
      </div>
    </div>
  );
}
