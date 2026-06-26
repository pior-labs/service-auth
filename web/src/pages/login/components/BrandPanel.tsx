import { BrandMark } from "@/components/BrandMark";

export function BrandPanel() {
  return (
    <section
      aria-labelledby="login-brand-heading"
      className="bloom-overlay-anim relative flex flex-col justify-between gap-10 py-2 md:py-6"
    >
      <header className="flex items-center gap-3">
        <BrandMark size={36} />
        <span className="font-serif text-[22px] font-medium italic tracking-tight">auth.pior.ca</span>
      </header>

      <div>
        <h1
          id="login-brand-heading"
          className="font-serif text-[clamp(44px,7.5vw,84px)] leading-[0.98] tracking-[-0.02em] text-ink"
        >
          Welcome
          <br />
          <span className="italic text-ink-2">
            back<span className="text-accent">.</span>
          </span>
        </h1>
        <p className="mt-7 max-w-md text-[15px] leading-[1.65] text-ink-2">
          Sign in with your household account to continue to the app that sent you here.
        </p>
      </div>

      <div aria-hidden="true" />
    </section>
  );
}
