// Row action menu for admin tables. Renders in a portal so table wrappers
// with overflow clipping can't cut it off, flips above the trigger when the
// viewport bottom is close, and supports Escape, arrow keys, Home and End.
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { DotsThree } from "@phosphor-icons/react";

export type RowMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  // Draws a divider above this item to group destructive actions
  separatorBefore?: boolean;
  onSelect: () => void;
};

type MenuPosition = { top: number; left: number; placement: "below" | "above" };

const GAP = 4;
const VIEWPORT_PAD = 8;

export default function RowActionMenu({
  items,
  ariaLabel,
  heading,
  triggerLabel = "Manage",
}: {
  items: Array<RowMenuItem>;
  ariaLabel: string;
  // Small caption at the top of the menu, for example the row's email
  heading?: string;
  triggerLabel?: string;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Position against the trigger after the menu mounts so its real size
  // decides the flip, then close on scroll, resize, or a click elsewhere
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();
    const height = menu.offsetHeight;
    const width = menu.offsetWidth;
    const spaceBelow = window.innerHeight - rect.bottom;
    const above =
      spaceBelow < height + GAP + VIEWPORT_PAD && rect.top > spaceBelow;
    const top = above
      ? Math.max(VIEWPORT_PAD, rect.top - height - GAP)
      : Math.min(
          rect.bottom + GAP,
          window.innerHeight - height - VIEWPORT_PAD,
        );
    const left = Math.min(
      Math.max(VIEWPORT_PAD, rect.right - width),
      window.innerWidth - width - VIEWPORT_PAD,
    );
    setPosition({ top, left, placement: above ? "above" : "below" });

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menu.contains(target) || trigger.contains(target)) return;
      close(false);
    };
    const onViewportChange = () => close(false);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [open, close]);

  // Hidden elements can't take focus, so wait until the menu is placed
  useLayoutEffect(() => {
    if (!position) return;
    menuRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus({ preventScroll: true });
  }, [position]);

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key === "Tab") {
      close(false);
      return;
    }
    const buttons = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ) ?? [],
    );
    if (buttons.length === 0) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = (index + 1) % buttons.length;
    if (e.key === "ArrowUp")
      next = (index - 1 + buttons.length) % buttons.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = buttons.length - 1;
    if (next !== null) {
      e.preventDefault();
      buttons[next].focus();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/20 ${
          open
            ? "border-text-primary/30 bg-bg-hover text-text-primary"
            : "border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        }`}
      >
        <DotsThree size={14} weight="bold" />
        <span className="hidden sm:inline">{triggerLabel}</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={ariaLabel}
            onKeyDown={handleMenuKeyDown}
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
            className={`fixed z-50 w-52 rounded-lg border border-border bg-white p-1 shadow-lg transition-opacity duration-100 ${
              position ? "opacity-100" : "opacity-0"
            } ${position?.placement === "above" ? "origin-bottom-right" : "origin-top-right"}`}
          >
            {heading && (
              <p className="truncate px-2 pb-1 pt-1.5 text-[10px] text-text-secondary">
                {heading}
              </p>
            )}
            {items.map((item) => (
              <div key={item.key}>
                {item.separatorBefore && (
                  <div role="separator" className="my-1 h-px bg-border" />
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close(false);
                    item.onSelect();
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors focus-visible:outline-none ${
                    item.danger
                      ? "text-red-600 hover:bg-red-500/10 focus-visible:bg-red-500/10"
                      : "text-text-primary hover:bg-bg-hover focus-visible:bg-bg-hover"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
