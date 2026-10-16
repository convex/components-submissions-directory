import { ExternalLinkIcon } from "@radix-ui/react-icons";

type FooterLink = {
  label: string;
  href: string;
  icon?: string;
  isExternal?: boolean;
};

type FooterCategory = {
  name: string;
  links: FooterLink[];
};

const categoriesWithLinks: FooterCategory[] = [
  {
    name: "Product",
    links: [
      { label: "Sync", href: "https://convex.dev/sync" },
      { label: "Realtime", href: "https://convex.dev/realtime" },
      { label: "Auth", href: "https://convex.dev/auth" },
      { label: "Open source", href: "https://convex.dev/open-source" },
      { label: "AI coding", href: "https://convex.dev/ai" },
      { label: "FAQ", href: "https://convex.dev/faq" },
      { label: "Chef", href: "https://chef.convex.dev", isExternal: true },
      { label: "Merch", href: "https://store.convex.dev/", isExternal: true },
      { label: "Pricing", href: "https://convex.dev/pricing" },
    ],
  },
  {
    name: "Developers",
    links: [
      { label: "Docs", href: "https://docs.convex.dev", isExternal: true },
      { label: "Blog", href: "https://stack.convex.dev", isExternal: true },
      { label: "Components", href: "https://convex.dev/components" },
      { label: "Templates", href: "https://convex.dev/templates" },
      { label: "Convex for Startups", href: "https://convex.dev/startups" },
      {
        label: "Convex for Open Source",
        href: "https://convex.dev/open-source-program",
      },
      { label: "Convex for Claw", href: "https://convex.dev/claw" },
      { label: "Champions", href: "https://convex.dev/champions" },
      { label: "Changelog", href: "https://ship.convex.dev/" },
      { label: "Podcast", href: "https://convex.dev/podcast" },
      {
        label: "LLMs.txt",
        href: "https://docs.convex.dev/llms.txt",
        isExternal: true,
      },
    ],
  },
  {
    name: "Company",
    links: [
      { label: "About us", href: "https://convex.dev/about-us" },
      { label: "Brand", href: "https://convex.dev/brand" },
      { label: "Investors", href: "https://convex.dev/investors" },
      { label: "Become a partner", href: "https://convex.dev/partners/apply" },
      { label: "Jobs", href: "https://convex.dev/jobs" },
      { label: "News", href: "https://news.convex.dev", isExternal: true },
      { label: "Events", href: "https://convex.dev/events" },
      { label: "Security", href: "https://convex.dev/security" },
      { label: "Legal", href: "https://convex.dev/legal" },
    ],
  },
  {
    name: "Social",
    links: [
      {
        label: "Twitter",
        href: "https://x.com/convex",
        icon: "/components/twitter.svg",
        isExternal: true,
      },
      {
        label: "Discord",
        href: "https://convex.dev/community",
        icon: "/components/discord.svg",
        isExternal: true,
      },
      {
        label: "YouTube",
        href: "https://www.youtube.com/@convex-dev",
        icon: "/components/youtube.svg",
        isExternal: true,
      },
      {
        label: "Luma",
        href: "https://lu.ma/convex",
        icon: "/components/luma.svg",
        isExternal: true,
      },
      {
        label: "LinkedIn",
        href: "https://www.linkedin.com/company/convex-dev",
        icon: "/components/linkedin.svg",
        isExternal: true,
      },
      {
        label: "GitHub",
        href: "https://github.com/convex",
        icon: "/components/github.svg",
        isExternal: true,
      },
    ],
  },
];

const trustItems = [
  { title: "SOC 2", subtitle: "Type II Compliant" },
  { title: "HIPAA", subtitle: "Compliant" },
  { title: "GDPR", subtitle: "Verified" },
];

const currentYear = new Date().getUTCFullYear();

export default function Footer() {
  return (
    <footer className="bg-[#141414] pb-8 pt-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid grid-cols-2 gap-y-12 gap-x-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 text-white">
          {/* Logo */}
          <a
            href="https://convex.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 md:col-span-4 lg:col-span-5 xl:col-span-1 xl:row-span-2 hover:opacity-80 transition-opacity">
            <img
              src="/components/logo.svg"
              alt="Convex"
              width={128}
              height={24}
              className="w-[7rem] xl:min-w-[128px]"
            />
          </a>

          {/* Link columns */}
          {categoriesWithLinks.map((category) => (
            <div
              key={category.name}
              className={`col-span-1 flex flex-col gap-5 ${
                category.name === "Social"
                  ? "lg:col-start-5 xl:col-span-2 xl:col-start-6"
                  : "xl:row-span-2"
              }`}>
              <span className="text-sm leading-tight tracking-wide text-[#767983]">
                {category.name}
              </span>
              <div className="flex flex-col gap-4">
                {category.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-[0.9375rem] leading-tight transition-colors hover:text-[#9799a4]">
                    {link.icon && (
                      <img
                        src={link.icon}
                        width={18}
                        height={18}
                        className="mr-2"
                        alt=""
                        aria-hidden="true"
                      />
                    )}
                    {link.label}
                    {link.isExternal && (
                      <ExternalLinkIcon
                        className="relative -top-0.5 left-1 h-3 w-3 text-[#767983]"
                        aria-label="Opens in a new tab"
                      />
                    )}
                  </a>
                ))}
              </div>
            </div>
          ))}

          {/* Trust section */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1 lg:col-start-5 xl:col-span-2 xl:col-start-6 flex flex-col gap-4">
            <span className="text-sm leading-tight tracking-wide text-[#767983]">
              A Trusted Solution
            </span>
            <ul className="flex flex-col gap-4">
              {trustItems.map((item) => (
                <li key={item.title} className="flex items-center gap-2">
                  <img
                    src="/components/trustCheck.svg"
                    width={20}
                    height={20}
                    alt=""
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{item.title}</strong> {item.subtitle}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Copyright */}
          <div className="col-span-2 md:col-span-4 lg:col-span-5 xl:col-span-6 pt-4">
            &copy;{currentYear} Convex, Inc.
          </div>
        </div>
      </div>
    </footer>
  );
}
