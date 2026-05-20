/** Normalize GET /admin/services list body (array or paginated `data.data`). */
export function parseAdminServicesList(
  raw: unknown
): { id: number; name: string }[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)
      ? (raw as { data: unknown[] }).data
      : [];
  return list
    .map((s: { id?: number | string; name?: string }) => ({
      id: Number(s.id),
      name: String(s.name ?? ''),
    }))
    .filter((s) => !Number.isNaN(s.id) && s.id > 0 && s.name);
}
