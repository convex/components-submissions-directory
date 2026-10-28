// Hover and focus tooltip rendered in a portal so scroll areas and
// overflow hidden cards can't clip it. Flips to the opposite side when the
// preferred side runs out of viewport room and clamps to the screen edges.
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Side = "top" | "bottom" | "left" | "right";
type Placement = { top: number; left: number; side: Side; arrow: number };

const GAP = 6;
const PAD = 8;
const ARROW_INSET = 8;

const ARROW_CLASS: Record<Side, string> = {
  top: "top-full -translate-x-1/2 border-t-dark",
  bottom: "bottom-full -translate-x-1/2 border-b-dark",
  left: "left-full -translate-y-1/2 border-l-dark",
  right: "right-full -translate-y-1/2 border-r-dark",
};

const OPPOSITE: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// Picks the preferred side unless it overflows and the opposite side fits
function place(anchor: DOMRect, width: number, height: number, preferred: Side): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fits: Record<Side, boolean> = {
    top: anchor.top - GAP - height >= PAD,
    bottom: anchor.bottom + GAP + height <= vh - PAD,
    left: anchor.left - GAP - width >= PAD,
    right: anchor.right + GAP + width <= vw - PAD,
  };
  const side =
    !fits[preferred] && fits[OPPOSITE[preferred]] ? OPPOSITE[preferred] : preferred;

  if (side === "top" || side === "bottom") {
    const centerX = anchor.left + anchor.width / 2;
    const left = clamp(centerX - width / 2, PAD, vw - width - PAD);
    return {
      side,
      left,
      top: side === "top" ? anchor.top - GAP - height : anchor.bottom + GAP,
      arrow: clamp(centerX - left, ARROW_INSET, width - ARROW_INSET),
    };
  }
  const centerY = anchor.top + anchor.height / 2;
  const top = clamp(centerY - height / 2, PAD, vh - height - PAD);
  return {
    side,
    top,
    left: side === "left" ? anchor.left - GAP - width : anchor.right + GAP,
    arrow: clamp(centerY - top, ARROW_INSET, height - ARROW_INSET),
  };
}

export default function HoverTooltip({
  children,
  content,
  position = "bottom",
}: {
  children: ReactNode;
  content: string;
  position?: Side;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => {
    setOpen(false);
    setPlacement(null);
  }, []);

  // Measure after mount, before paint, then hide on scroll or resize
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    setPlacement(
      place(anchor.getBoundingClientRect(), tip.offsetWidth, tip.offsetHeight, position),
    );
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, position, hide]);

  const vertical = placement?.side === "top" || placement?.side === "bottom";

  return (
    <div
      ref={anchorRef}
      className="relative group"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            style={{
              top: placement?.top ?? 0,
              left: placement?.left ?? 0,
              visibility: placement ? "visible" : "hidden",
            }}
            className={`fixed z-[60] px-2 py-1 text-xs font-normal text-white bg-dark rounded shadow-lg pointer-events-none whitespace-nowrap transition-opacity duration-150 ${
              placement ? "opacity-100" : "opacity-0"
            }`}
          >
            {content}
            {placement && (
              <div
                style={vertical ? { left: placement.arrow } : { top: placement.arrow }}
                className={`absolute border-4 border-transparent ${ARROW_CLASS[placement.side]}`}
              />
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
