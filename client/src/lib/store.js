export function formatXof(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '— FCFA';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.trunc(amount))} FCFA`;
}

export function makeSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}
