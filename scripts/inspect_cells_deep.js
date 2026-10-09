const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const workbookPath = path.resolve(__dirname, '../AQ_Companies_System_v10_Logistics.xlsx');
const wb = XLSX.readFile(workbookPath, { cellFormula: true, cellStyles: true, cellNF: true, raw: false });

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  console.log(`\n=== SHEET: ${sheetName} ===`);
  const keys = Object.keys(ws).filter(k => !k.startsWith('!'));
  console.log(`Total cells: ${keys.length}`);
  keys.forEach(k => {
    const cell = ws[k];
    if (cell.f || (typeof cell.v === 'string' && cell.v.startsWith('='))) {
      console.log(`Cell ${k} Formula: ${cell.f || cell.v} (Evaluated val: ${cell.v})`);
    }
  });
});
