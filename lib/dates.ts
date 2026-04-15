export function localDateISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localWeekAgoISO(d: Date = new Date()): string {
  const c = new Date(d);
  c.setDate(c.getDate() - 6);
  return localDateISO(c);
}
