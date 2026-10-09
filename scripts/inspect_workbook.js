const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const workbookPath = path.resolve(__dirname, '../AQ_Companies_System_v10_Logistics.xlsx');
console.log('Loading workbook from:', workbookPath);

const wb = XLSX.readFile(workbookPath, { cellFormula: true, cellNF: true, cellDates: true });

console.log('Sheet Names:', wb.SheetNames);

const report = {
  sheetNames: wb.SheetNames,
  sheets: {}
};

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const ref = ws['!ref'];
  const range = XLSX.utils.decode_range(ref || 'A1:A1');
  
  console.log(`\n==============================================`);
  console.log(`Sheet: "${sheetName}" | Range: ${ref} (Rows: ${range.e.r + 1}, Cols: ${range.e.c + 1})`);
  console.log(`==============================================`);

  const sheetData = [];
  const formulas = [];
  
  // Extract all rows as array of arrays
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    let hasData = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellAddress];
      if (cell) {
        hasData = true;
        row.push({
          col: c,
          address: cellAddress,
          val: cell.v,
          formatted: cell.w,
          formula: cell.f,
          type: cell.t
        });
        if (cell.f) {
          formulas.push({ cell: cellAddress, formula: cell.f, val: cell.v });
        }
      } else {
        row.push(null);
      }
    }
    if (hasData) {
      sheetData.push({ rowNumber: r + 1, cells: row.filter(c => c !== null) });
    }
  }

  // Print first 15 rows for inspection
  console.log(`Total non-empty rows: ${sheetData.length}`);
  console.log(`Formulas count: ${formulas.length}`);
  console.log(`Merged ranges count: ${(ws['!merges'] || []).length}`);

  report.sheets[sheetName] = {
    range: ref,
    rowCount: range.e.r + 1,
    colCount: range.e.c + 1,
    nonEmptyRows: sheetData.length,
    merges: ws['!merges'] || [],
    sampleRows: sheetData.slice(0, 20).map(r => ({
      row: r.rowNumber,
      values: r.cells.map(c => `${c.address}:${c.val !== undefined ? c.val : ''}${c.formula ? ' [=' + c.formula + ']' : ''}`)
    })),
    allRows: sheetData.map(r => ({
      row: r.rowNumber,
      cells: r.cells
    })),
    formulas: formulas
  };
});

fs.writeFileSync(path.resolve(__dirname, 'inspection_summary.json'), JSON.stringify(report, null, 2));
console.log('\nInspection finished! Written to scripts/inspection_summary.json');
