import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";
import { useTheme } from "@ipior/custom-tailwind-shadcn-themes";

/**
 * Dropdown theme picker: a pill trigger showing the active theme, opening a
 * popover that lists each theme with its swatch, hint, and a check on the
 * active one. Re-skins with the page via theme helper tokens.
 */
export function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = themes.find((option) => option.id === theme) ?? themes[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change theme"
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink/12 bg-frost/70 px-4 py-2 text-[14px] text-ink shadow-[0_10px_30px_-16px_rgba(45,36,24,0.45),inset_0_1px_0_rgba(var(--frost-rgb),0.6)] backdrop-blur transition-colors hover:bg-frost/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
      >
        <Palette aria-hidden="true" className="h-4.5 w-4.5 text-accent" />
        <span className="font-medium">{active.name}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 text-ink-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Theme"
          className="bloom-overlay-anim absolute left-0 top-[calc(100%+10px)] z-20 w-65 overflow-hidden rounded-2xl border border-ink/10 bg-frost/95 p-2 shadow-[0_28px_60px_-24px_rgba(45,36,24,0.5),inset_0_1px_0_rgba(var(--frost-rgb),0.7)] backdrop-blur"
        >
          <div className="px-3 pb-1.5 pt-1 font-serif text-[12px] italic tracking-wide text-ink-2">
            Theme
          </div>
          <div className="flex flex-col gap-0.5">
            {themes.map((option) => {
              const isActive = option.id === theme;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    setTheme(option.id);
                    setOpen(false);
                  }}
                  className={[
                    "flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent px-3 py-2.5 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45",
                    isActive ? "bg-accent/12" : "hover:bg-ink/5",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgba(var(--frost-rgb),0.6)]"
                  >
                    <span className="h-full w-1/2" style={{ background: option.swatch[2] }} />
                    <span className="h-full w-1/2" style={{ background: option.swatch[1] }} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-[14px] font-medium text-ink">{option.name}</span>
                    <span className="text-[12px] text-ink-2">{option.hint}</span>
                  </span>
                  {isActive && (
                    <Check aria-hidden="true" className="h-4.5 w-4.5 shrink-0 text-accent" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
