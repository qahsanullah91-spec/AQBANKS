const XLSX = require('xlsx');
const path = require('path');
const wb = XLSX.readFile(path.resolve(__dirname, '../AQ_Companies_System_v10_Logistics.xlsx'), { raw: true, cellDates: false });

console.log('=== RAW CELL TYPES AND VALUES ===');
['Account Statement', 'Proforma Invoices', 'Logistics & Tracking'].forEach(sheetName => {
  console.log(`\n--- SHEET: ${sheetName} ---`);
  const ws = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowValues = [];
    let hasVal = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell) {
        hasVal = true;
        rowValues.push(`${addr}: [type=${cell.t}, val=${JSON.stringify(cell.v)}]`);
      }
    }
    if (hasVal) {
      console.log(`Row ${r+1}:`, rowValues.join(' | '));
    }
  }
});
