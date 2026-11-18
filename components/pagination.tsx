const btn = "h-10 rounded-md border px-4 text-sm font-medium disabled:opacity-40";

export function Pagination({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
      <span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
      <button type="button" className={btn} disabled={page >= pageCount} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  );
}
