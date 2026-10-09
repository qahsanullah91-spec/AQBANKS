const XLSX = require('xlsx');
const path = require('path');
const wb = XLSX.readFile(path.resolve(__dirname, '../AQ_Companies_System_v10_Logistics.xlsx'), { raw: true, cellDates: false });

console.log(`\n--- SHEET: Overview ---`);
const ws = wb.Sheets['Overview'];
const range = XLSX.utils.decode_range(ws['!ref']);
for (let r = range.s.r; r <= range.e.r; r++) {
  const rowValues = [];
  let hasVal = false;
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = ws[addr];
    if (cell && (cell.v !== undefined && cell.v !== '')) {
      hasVal = true;
      rowValues.push(`${addr}: [val=${JSON.stringify(cell.v)}${cell.f ? ', f=' + cell.f : ''}]`);
    }
  }
  if (hasVal) {
    console.log(`Row ${r+1}:`, rowValues.join(' | '));
  }
}
