/**
 * AQ Companies & Sky Ariana Ltd - Corporate Portal
 * High-Precision Deterministic Date Formatting Utilities
 * Prevents UTC off-by-one backward date shifts in negative timezones
 */

export function formatDisplayDate(input: string | Date | null | undefined): string {
  if (!input) return '—';
  
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${parseInt(month, 10)}/${parseInt(day, 10)}/${year}`;
    }
  }

  const d = new Date(input);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

export function formatFullDate(input: string | Date | null | undefined): string {
  if (!input) return '—';

  if (typeof input === 'string') {
    const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      const d = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10)));
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(/ /g, '-');
    }
  }

  const d = new Date(input);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(/ /g, '-');
}

export function formatHumanDate(input: string | Date | null | undefined): string {
  if (!input) return '—';
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      const d = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10)));
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    }
  }
  const d = new Date(input);
  if (isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateForInput(input: string | Date | null | undefined): string {
  if (!input) return new Date().toISOString().split('T')[0];
  if (typeof input === 'string') {
    const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = new Date(input);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  return d.toISOString().split('T')[0];
}
