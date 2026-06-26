type LoginErrorMessageProps = {
  id: string;
  error: string | null;
};

export function LoginErrorMessage({ id, error }: LoginErrorMessageProps) {
  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      className={[
        "overflow-hidden text-[13px] leading-snug text-accent transition-[max-height,opacity,margin] duration-200 ease-out",
        error ? "mt-0 max-h-24 opacity-100" : "-mt-3 max-h-0 opacity-0",
      ].join(" ")}
    >
      {error ? (
        <span className="flex items-start gap-2 rounded-2xl border border-accent/25 bg-[rgba(248,215,192,0.45)] px-3.5 py-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          <span>{error}</span>
        </span>
      ) : (
        <span aria-hidden="true">&nbsp;</span>
      )}
    </div>
  );
}
