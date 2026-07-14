import { BrandPanel } from "./components/BrandPanel";
import { LoginFormPanel } from "./components/LoginFormPanel";
import { useLoginForm } from "./hooks/useLoginForm";

export function LoginPage() {
  const form = useLoginForm();

  return (
    <div className="relative min-h-dvh overflow-hidden bg-cream font-sans text-ink">
      <div className="theme-mesh" aria-hidden="true">
        <div className="theme-blob b1" />
        <div className="theme-blob b2" />
        <div className="theme-blob b3" />
        <div className="theme-blob b4" />
        <div className="theme-blob b5" />
      </div>
      <div className="theme-grain" aria-hidden="true" />

      <main
        id="main-content"
        className="relative z-2 mx-auto grid min-h-dvh w-full max-w-310 grid-cols-1 gap-10 px-5 py-[max(2rem,env(safe-area-inset-top))] md:grid-cols-[1fr_1fr] md:gap-16 md:px-12 md:py-10 lg:gap-24 lg:px-16"
      >
        <BrandPanel />
        <LoginFormPanel {...form} />
      </main>
    </div>
  );
}
