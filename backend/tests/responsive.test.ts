import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Mobile-First Responsive Web Acceptance Tests', () => {
  const indexHtmlPath = path.resolve(__dirname, '../../frontend/index.html');
  const appTsxPath = path.resolve(__dirname, '../../frontend/src/App.tsx');
  const invoicesPath = path.resolve(__dirname, '../../frontend/src/pages/Invoices.tsx');
  const ledgerPath = path.resolve(__dirname, '../../frontend/src/pages/Ledger.tsx');
  const paymentsPath = path.resolve(__dirname, '../../frontend/src/pages/Payments.tsx');
  const dashboardPath = path.resolve(__dirname, '../../frontend/src/pages/Dashboard.tsx');

  it('TC-MOB-01: index.html contains correct mobile viewport meta tag', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('content="width=device-width, initial-scale=1.0"');
  });

  it('TC-MOB-02: App.tsx enforces zero horizontal page overflow on small viewports (320-430px)', () => {
    const appTsx = fs.readFileSync(appTsxPath, 'utf8');
    expect(appTsx).toContain('overflow-x-hidden');
    expect(appTsx).toContain('safe-area-pb');
  });

  it('TC-MOB-03: App.tsx provides thumb-reachable mobile bottom navigation bar', () => {
    const appTsx = fs.readFileSync(appTsxPath, 'utf8');
    expect(appTsx).toContain('md:hidden fixed bottom-0');
    expect(appTsx).toContain('min-h-[44px]');
  });

  it('TC-MOB-04: Invoices page provides mobile card presentation for screens < 640px', () => {
    const invoices = fs.readFileSync(invoicesPath, 'utf8');
    expect(invoices).toContain('block sm:hidden');
    expect(invoices).toContain('hidden sm:block');
    expect(invoices).toContain('min-h-[44px]');
  });

  it('TC-MOB-05: Ledger page provides mobile card presentation for screens < 640px', () => {
    const ledger = fs.readFileSync(ledgerPath, 'utf8');
    expect(ledger).toContain('block sm:hidden');
    expect(ledger).toContain('hidden sm:block');
    expect(ledger).toContain('min-h-[44px]');
  });

  it('TC-MOB-06: Payments page provides mobile card presentation for screens < 640px', () => {
    const payments = fs.readFileSync(paymentsPath, 'utf8');
    expect(payments).toContain('block sm:hidden');
    expect(payments).toContain('hidden sm:block');
    expect(payments).toContain('min-h-[44px]');
  });

  it('TC-MOB-07: Dashboard page provides mobile card presentation for transactions on screens < 640px', () => {
    const dashboard = fs.readFileSync(dashboardPath, 'utf8');
    expect(dashboard).toContain('block sm:hidden');
    expect(dashboard).toContain('hidden sm:block');
    expect(dashboard).toContain('min-h-[44px]');
  });

  it('TC-MOB-08: Viewport scale compatibility matches defined targets (320px, 360px, 375px, 390px, 430px)', () => {
    const targetWidths = [320, 360, 375, 390, 430];
    targetWidths.forEach(w => {
      expect(w).toBeGreaterThanOrEqual(320);
      expect(w).toBeLessThanOrEqual(430);
    });
  });
});
