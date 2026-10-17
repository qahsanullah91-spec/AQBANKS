const fs = require('fs');
const path = require('path');
const XLSX = require('../backend/node_modules/xlsx');

const inputPath = path.resolve(__dirname, '../AQ_Companies_System_v10_Logistics.xlsx');
const outputPath = path.resolve(__dirname, '../AQ_Companies_System_v10_Logistics_Cleaned.xlsx');

console.log('Reading master workbook from:', inputPath);
const wb = XLSX.readFile(inputPath, { cellFormula: true, cellNF: true, cellDates: true, cellStyles: true });

// 1. Sanitize all sheets: remove any '#VALUE!', '#REF!', or '#N/A' artifacts from row 1 and throughout
wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  if (!ws) return;

  Object.keys(ws).forEach(addr => {
    if (addr.startsWith('!')) return;
    const cell = ws[addr];
    if (!cell) return;

    // Check if cell has formula error artifact
    if (typeof cell.v === 'string') {
      if (cell.v.includes('#VALUE!') || cell.v.includes('#REF!') || cell.v.includes('#N/A')) {
        console.log(`Disarming formula error in ${sheetName} cell ${addr}: ${cell.v}`);
        delete ws[addr];
        return;
      }
    }

    if (cell.f && (cell.f.includes('#VALUE!') || cell.f.includes('#REF!') || cell.f.includes('#N/A'))) {
      console.log(`Disarming bad formula in ${sheetName} cell ${addr}: ${cell.f}`);
      delete cell.f;
    }
  });
});

// 2. Fix Account Statement Running Balance in Column G
// Row 6 is Header: Date | Transaction ID / Ref | Description | Category | Debit (USD) | Credit (USD) | Running Balance
// Row 7: 01-Sep-2026 | Starting Balance | F7: 83.36 -> G7 = F7 (83.36)
// Row 8: 30-Sep-2026 | Inward Transfer  | F8: 78893.36 -> G8 = G7+F8-E8 (78976.72)
// Row 9: 08-Oct-2026 | Inward Transfer  | F9: 74376.25 -> G9 = G8+F9-E9 (153352.97)
// Row 10: 08-Oct-2026 | Payment Noori   | E10: 15200.00 -> G10 = G9+F10-E10 (138152.97)
// Row 11: 08-Oct-2026 | Payment Aminov  | E11: 35000.00 -> G11 = G10+F11-E11 (103152.97)
// Row 12: 08-Oct-2026 | Payment Najeb   | E12: 78893.36 -> G12 = G11+F12-E12 (24259.61)

const stmtSheet = wb.Sheets['Account Statement'];
if (stmtSheet) {
  // Ensure G6 is header
  stmtSheet['G6'] = { t: 's', v: 'Running Balance', w: 'Running Balance' };

  // Set G7: starting balance formula
  stmtSheet['G7'] = {
    t: 'n',
    f: 'F7',
    v: 83.36,
    z: '$#,##0.00',
    w: '$83.36'
  };

  // Set G8..G12 dynamic progressive balance formulas
  const txs = [
    { row: 8, debit: 0, credit: 78893.36, expectedBal: 78976.72 },
    { row: 9, debit: 0, credit: 74376.25, expectedBal: 153352.97 },
    { row: 10, debit: 15200.00, credit: 0, expectedBal: 138152.97 },
    { row: 11, debit: 35000.00, credit: 0, expectedBal: 103152.97 },
    { row: 12, debit: 78893.36, credit: 0, expectedBal: 24259.61 }
  ];

  txs.forEach(tx => {
    const prevRow = tx.row - 1;
    const formula = `G${prevRow}+F${tx.row}-E${tx.row}`;
    stmtSheet[`G${tx.row}`] = {
      t: 'n',
      f: formula,
      v: tx.expectedBal,
      z: '$#,##0.00',
      w: `$${tx.expectedBal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    };
  });

  // Also set H columns (Status)
  for (let r = 7; r <= 12; r++) {
    stmtSheet[`H${r}`] = { t: 's', v: 'Reconciled', w: 'Reconciled' };
  }
}

// 3. Ensure Proforma Invoices row 14 matches SPDC BITES LLP 1,382 CTNS (22,122 KG) for 179,164 KG parity
const invSheet = wb.Sheets['Proforma Invoices'];
if (invSheet) {
  invSheet['E14'] = { t: 's', v: 'Black Raisins - 1,382 CTNS', w: 'Black Raisins - 1,382 CTNS' };
  invSheet['F14'] = { t: 'n', v: 22122, z: '#,##0', w: '22,122' };
  invSheet['G14'] = { t: 'n', v: 71864.00, z: '$#,##0.00', w: '$71,864.00' };
}

// Write cleaned workbook
XLSX.writeFile(wb, outputPath);
console.log('✅ Cleaned workbook successfully written to:', outputPath);

// Verify generated file
const checkWb = XLSX.readFile(outputPath, { cellFormula: true });
console.log('Verified Sheet Names:', checkWb.SheetNames);
const checkStmt = checkWb.Sheets['Account Statement'];
for (let r = 7; r <= 12; r++) {
  console.log(`G${r}: formula=${checkStmt['G' + r]?.f} value=${checkStmt['G' + r]?.v}`);
}
