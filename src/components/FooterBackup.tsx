export default function Footer() {
  return (
    <footer className="mt-12 pt-6 pb-6 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <a
            href="https://convex.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity">
            <img src="/components/convex-wordmark-black.svg" alt="Convex" className="h-10" />
          </a>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/convex/convex-backend"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              GitHub
            </a>
            <a
              href="https://discord.gg/convex"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Discord
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
