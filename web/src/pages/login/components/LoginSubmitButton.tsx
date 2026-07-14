import { ArrowRight, LoaderCircle } from "lucide-react";

type LoginSubmitButtonProps = {
  loading: boolean;
  errorId: string;
  hasError: boolean;
};

export function LoginSubmitButton({ loading, errorId, hasError }: LoginSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-describedby={hasError ? errorId : undefined}
      className="group relative mt-1 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2.5 overflow-hidden rounded-full border border-ink/15 bg-ink px-6 py-3 font-sans text-[15px] font-medium text-cream shadow-[0_14px_36px_-12px_rgba(45,36,24,0.55),inset_0_1px_0_rgba(var(--frost-rgb),0.06)] transition-[transform,box-shadow,background-color] duration-300 ease-out hover:-translate-y-px hover:bg-[#3b3022] hover:shadow-[0_18px_42px_-12px_rgba(45,36,24,0.6),inset_0_1px_0_rgba(var(--frost-rgb),0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55 focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-progress disabled:opacity-80 motion-reduce:hover:translate-y-0"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(120% 60% at 50% 0%, rgba(248,215,192,0.18), transparent 60%)",
        }}
      />
      <span className="relative">{loading ? "Signing in…" : "Continue"}</span>
      {loading ? (
        <LoaderCircle aria-hidden="true" className="relative h-4 w-4 animate-spin" />
      ) : (
        <ArrowRight
          aria-hidden="true"
          className="relative h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
        />
      )}
    </button>
  );
}
