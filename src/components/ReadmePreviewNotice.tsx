import { useState } from "react";
import { ToggleLeft, ToggleRight } from "@phosphor-icons/react";

interface ReadmePreviewNoticeProps {
  readmeIncludeSource?: "markers" | "full" | "";
}

const COMPONENT_TEMPLATE_URL =
  "https://github.com/convex/templates/tree/main/template-component";

export default function ReadmePreviewNotice({
  readmeIncludeSource,
}: ReadmePreviewNoticeProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <details
      open
      className="mb-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-text-secondary"
      onToggle={(event) => setIsOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none font-medium text-text-primary">
        <span className="flex items-center gap-2">
          {isOpen ? (
            <ToggleRight size={18} weight="fill" className="text-text-primary" />
          ) : (
            <ToggleLeft size={18} className="text-text-secondary" />
          )}
          README preview source
        </span>
      </summary>
      <div className="mt-2 space-y-2 leading-relaxed">
        {readmeIncludeSource === "markers" ? (
          <p>
            Showing content between
            {" "}
            <code>{`<!-- START: Include on https://convex.dev/components -->`}</code>
            {" "}
            and
            {" "}
            <code>{`<!-- END: Include on https://convex.dev/components -->`}</code>
            {" "}
            in the README.
          </p>
        ) : (
          <p>
            No content found between
            {" "}
            <code>{`<!-- START: Include on https://convex.dev/components -->`}</code>
            {" "}
            and
            {" "}
            <code>{`<!-- END: Include on https://convex.dev/components -->`}</code>
            {" "}
            so the full README preview is shown instead.
          </p>
        )}
        <p>
          See the
          {" "}
          <a
            href={COMPONENT_TEMPLATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8D2676] hover:underline"
          >
            official component template
          </a>
          {" "}
          for the recommended marker setup.
        </p>
      </div>
    </details>
  );
}
