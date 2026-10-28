// Round avatar for admin tables; falls back to the first letter of the name
export default function UserAvatar({
  email,
  name,
  pictureUrl,
  size = 24,
}: {
  email: string;
  name?: string;
  pictureUrl?: string;
  size?: number;
}) {
  const initial = (name || email).trim().charAt(0).toUpperCase() || "?";
  if (pictureUrl) {
    return (
      <img
        src={pictureUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full border border-border object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-bg-hover text-[10px] font-medium text-text-secondary"
      style={{ width: size, height: size }}
    >
      {initial}
    </span>
  );
}
