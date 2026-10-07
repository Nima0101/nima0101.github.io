const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const base = process.env.SITE_URL || 'http://127.0.0.1:8765/';
  const output = 'site-artifacts';
  fs.mkdirSync(output, { recursive: true });
  const results = [];
  try {
    for (const [name, width, height, colorScheme] of [
      ['desktop', 1440, 1100, 'light'],
      ['mobile', 390, 844, 'light'],
      ['small-mobile', 320, 700, 'light'],
      ['tablet', 768, 1024, 'light'],
      ['dark', 1440, 1100, 'dark'],
      ['dark-mobile', 390, 844, 'dark'],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, colorScheme, javaScriptEnabled: false });
      const requests = [];
      page.on('request', request => requests.push(request.url()));
      const response = await page.goto(base, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      for (const img of await page.locator('img').all()) await img.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.images].every(img => img.complete));
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `${output}/${name}.png` });
      if (name === 'desktop') await page.screenshot({ path: `${output}/desktop-full.png`, fullPage: true });
      if (name === 'mobile') await page.screenshot({ path: `${output}/mobile-full.png`, fullPage: true });
      const rendered = await page.evaluate(() => ({
        h1: document.querySelector('h1').textContent,
        overflow: document.documentElement.scrollWidth > innerWidth,
        brokenFragments: [...document.querySelectorAll('a[href^="#"]')].filter(a => !document.getElementById(a.hash.slice(1))).map(a => a.hash),
        visibleText: document.body.innerText.length,
        images: [...document.images].map(img => ({ src: img.getAttribute('src'), alt: img.alt, loaded: img.complete && img.naturalWidth > 0, width: img.getBoundingClientRect().width, naturalWidth: img.naturalWidth })),
        headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => Number(h.tagName[1])),
      }));
      assert.match(rendered.h1, /Nima Khaki/);
      assert.equal(rendered.images.length, 7);
      assert.ok(rendered.images.every(img => img.loaded && img.alt && img.width <= img.naturalWidth), `${name}: images load with alt text and without upscaling`);
      assert.ok(rendered.headings.every((level, i, levels) => !i || level <= levels[i - 1] + 1), `${name}: heading hierarchy`);
      if (rendered.overflow) {
        console.error(await page.evaluate(() => [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth).map(e => ({ tag: e.tagName, class: e.className, text: e.textContent.slice(0,160) }))));
      }
      assert.equal(rendered.overflow, false, `${name}: horizontal overflow`);
      assert.deepEqual(rendered.brokenFragments, []);
      assert.ok(rendered.visibleText > 10000, 'Full narrative works with JavaScript disabled');
      assert.deepEqual(requests.filter(url => !url.startsWith(base)), [], 'No third-party page requests');
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').innerText(), 'Skip to content');
      await page.keyboard.press('Enter');
      assert.equal(new URL(page.url()).hash, '#main');
      await page.close();

      const context = await browser.newContext({ viewport: { width, height }, colorScheme });
      const accessible = await context.newPage();
      await accessible.goto(base);
      const audit = await new AxeBuilder({ page: accessible }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      results.push({ name, ...rendered, violations: audit.violations, incomplete: audit.incomplete.map(x => ({ id: x.id, nodes: x.nodes.length })), passedRules: audit.passes.length });
      await context.close();
    }
    fs.writeFileSync(`${output}/report.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    assert.equal(results.reduce((n, r) => n + r.violations.length, 0), 0, 'Accessibility violations');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
