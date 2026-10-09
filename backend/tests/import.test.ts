import { describe, it, expect } from 'vitest';
import path from 'path';
import { parseWorkbook } from '../src/modules/import/import.routes.js';

describe('Workbook Import & Integrity Tests', () => {
  const workbookPath = path.resolve(__dirname, '../../AQ_Companies_System_v10_Logistics.xlsx');

  it('TC-IMP-01: verifies untouched source file SHA-256 hash matches exactly', () => {
    const result = parseWorkbook(workbookPath);
    expect(result.fileHash).toBe('BC25181951738F3A3E668DC5D3564747447DE549A6CB85F59D28313EA05464EA');
  });

  it('TC-IMP-02: parses all 6 sheets with exact row counts', () => {
    const result = parseWorkbook(workbookPath);

    // 1 Bank Account
    expect(result.bankDetails.bankName).toBe('AFGHAN UNITED BANK');
    expect(result.bankDetails.beneficiaryName).toBe('SKY ARIANA LTD');
    expect(result.bankDetails.accountNumber).toBe('101502USD2940472');

    // 6 Ledger rows
    expect(result.ledger.rows).toHaveLength(6);

    // 8 Proforma Invoices
    expect(result.invoices.rows).toHaveLength(8);

    // 2 Active Shipments
    expect(result.shipments.rows).toHaveLength(2);
  });

  it('TC-IMP-03: accurately computes comparison checkpoint figures from source', () => {
    const result = parseWorkbook(workbookPath);

    // Provisional comparison checkpoints:
    // Credits: USD 153,352.97
    // Debits: USD 129,093.36
    // Available Balance: USD 24,259.61
    // Total Invoiced: USD 555,090.30
    // Pending: USD 401,007.50
    expect(result.checkpointTotals.totalCredits).toBe('153352.97');
    expect(result.checkpointTotals.totalDebits).toBe('129093.36');
    expect(result.checkpointTotals.availableBalance).toBe('24259.61');
    expect(result.checkpointTotals.totalInvoiced).toBe('555090.30');
    expect(result.checkpointTotals.totalPending).toBe('401007.50');
  });

  it('TC-IMP-04: detects repeated proforma references and raises warnings', () => {
    const result = parseWorkbook(workbookPath);

    // Proforma "001" and "002" are repeated in the source
    const warning001 = result.invoices.warnings.find(w => w.includes('"001"'));
    const warning002 = result.invoices.warnings.find(w => w.includes('"002"'));

    expect(warning001).toBeDefined();
    expect(warning002).toBeDefined();

    // Shipment "001" ambiguous link warning
    const shipmentAmbiguous = result.shipments.warnings.find(w => w.includes('ambiguous'));
    expect(shipmentAmbiguous).toBeDefined();
  });
});
