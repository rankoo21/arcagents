export default function Footer() {
  return (
    <footer className="mt-24 border-t border-white/5 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <div>© {new Date().getFullYear()} ArcAgents</div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Built on Arc Network
        </div>
      </div>
    </footer>
  );
}
