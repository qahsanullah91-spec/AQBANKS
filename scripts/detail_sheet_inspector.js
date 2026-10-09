const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const workbookPath = path.resolve(__dirname, '../AQ_Companies_System_v10_Logistics.xlsx');
const wb = XLSX.readFile(workbookPath, { cellFormula: true, cellNF: true, cellDates: false });

wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  console.log(`\n======================================================`);
  console.log(`SHEET: ${name}`);
  console.log(`======================================================`);
  
  // Convert sheet to json with header: 1 (array of arrays)
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  rows.forEach((row, idx) => {
    // Check if row has any non-empty cell
    if (row && row.some(c => c !== undefined && c !== null && String(c).trim() !== '')) {
      console.log(`Row ${idx + 1}:`, JSON.stringify(row));
    }
  });
});
