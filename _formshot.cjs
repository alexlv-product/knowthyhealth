const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 920, height: 1300 } });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  // Landing → form
  try {
    await page.getByText(/try it on yourself/i).first().click({ timeout: 5000 });
  } catch {
    // maybe already on the form, or a different CTA label
    const btn = await page.getByRole('button').first();
    await btn.click().catch(() => {});
  }
  await page.waitForTimeout(900);
  const labels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('label')).slice(0, 4).map((l) => ({
      text: l.querySelector('span')?.textContent ?? '(no span)',
      spanColor: l.querySelector('span') ? getComputedStyle(l.querySelector('span')).color : 'n/a',
      spanDisplay: l.querySelector('span') ? getComputedStyle(l.querySelector('span')).display : 'n/a',
    }))
  );
  console.log('first labels:', JSON.stringify(labels, null, 2));
  await page.screenshot({ path: '_formshot.png', fullPage: true });
  console.log('saved _formshot.png');
  await browser.close();
})();
