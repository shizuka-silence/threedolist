// 1-based pages; an out-of-range page clamps (e.g. after completing the last task on the final page).
export function paginate<T>(items: T[], page: number, size = 10) {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pageCount);
  return { items: items.slice((current - 1) * size, current * size), page: current, pageCount };
}
