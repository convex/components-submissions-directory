// Mounted once in the app shell. Records the signed-in account, signs the
// browser out when an admin kicks or bans it, and shows a notice when the
// account is deactivated. The server enforces the write block either way.
import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useConnectAuth } from "../lib/connectAuth";

// Survives the sign-out redirect so the notice shows on the page they land on
const NOTICE_KEY = "accountStatusNotice";
const KICK_NOTICE =
  "You were signed out by the Convex team. You can sign in again anytime.";
const BAN_NOTICE =
  "This account has been banned. Contact the Convex team if you think this is a mistake.";

function readStoredNotice(): string | null {
  try {
    return sessionStorage.getItem(NOTICE_KEY);
  } catch {
    return null;
  }
}

function storeNotice(message: string): void {
  try {
    sessionStorage.setItem(NOTICE_KEY, message);
  } catch {
    // Private mode without storage: the user just won't see the notice
  }
}

function clearStoredNotice(): void {
  try {
    sessionStorage.removeItem(NOTICE_KEY);
  } catch {
    // Nothing stored
  }
}

export default function AccountStatusGuard() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useConnectAuth();
  const touchMyAccount = useMutation(api.userAccounts.touchMyAccount);
  const acknowledgeForcedSignOut = useMutation(
    api.userAccounts.acknowledgeForcedSignOut,
  );
  const status = useQuery(
    api.userAccounts.myAccountStatus,
    isAuthenticated ? {} : "skip",
  );

  const touchedRef = useRef(false);
  const signingOutRef = useRef(false);
  const [notice, setNotice] = useState<string | null>(readStoredNotice);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Record the account once per page load; the server only writes hourly
  useEffect(() => {
    if (!isAuthenticated || touchedRef.current) return;
    touchedRef.current = true;
    touchMyAccount({}).catch(() => {
      touchedRef.current = false;
    });
  }, [isAuthenticated, touchMyAccount]);

  // Kick or ban: clear the kick flag, then sign this browser out
  const kicked = status?.forceSignOutAt !== undefined;
  const banned = status?.status === "banned";
  const banMessage = status?.message;
  useEffect(() => {
    if ((!kicked && !banned) || signingOutRef.current) return;
    signingOutRef.current = true;
    storeNotice(banned ? (banMessage ?? BAN_NOTICE) : KICK_NOTICE);
    const acknowledged = kicked
      ? acknowledgeForcedSignOut({}).catch(() => null)
      : Promise.resolve(null);
    void acknowledged.then(() => signOut());
  }, [kicked, banned, banMessage, acknowledgeForcedSignOut, signOut]);

  const dismissNotice = () => {
    clearStoredNotice();
    setNotice(null);
  };

  const deactivated =
    isAuthenticated && status?.status === "deactivated" && !bannerDismissed;

  if (!notice && !deactivated) return null;

  const message = notice ?? status?.message ?? "";
  const reason = !notice ? status?.reason : undefined;
  const onDismiss = notice ? dismissNotice : () => setBannerDismissed(true);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 rounded-container border border-border bg-white px-4 py-3 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 text-sm text-text-primary">
          <p>{message}</p>
          {reason && (
            <p className="mt-1 text-xs text-text-secondary">Reason: {reason}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
