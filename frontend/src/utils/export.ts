/**
 * Universal CSV & Excel Export Utility for AQ Companies
 * Supports UTF-8 Byte Order Mark (BOM) for full international character compatibility (English & Pashto),
 * proper RFC 4180 CSV escaping, and browser-safe automatic download triggers.
 */

export function downloadBlob(filename: string, content: string, mimeType: string = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function escapeCsvCell(cell: string | number | null | undefined): string {
  if (cell === null || cell === undefined) return '';
  const str = String(cell);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  // UTF-8 BOM ensures Excel properly recognizes UTF-8 encoded text and currencies
  const BOM = '\uFEFF';
  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map(escapeCsvCell).join(','));

  // Data rows
  for (const row of rows) {
    csvRows.push(row.map(escapeCsvCell).join(','));
  }

  const csvContent = BOM + csvRows.join('\r\n');
  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  downloadBlob(safeFilename, csvContent, 'text/csv;charset=utf-8;');
}
