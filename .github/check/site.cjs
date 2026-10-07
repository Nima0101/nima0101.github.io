const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch();
  const base = process.env.SITE_URL || 'http://127.0.0.1:8765/';
  const output = process.env.SITE_ARTIFACTS || 'site-artifacts';
  fs.mkdirSync(output, { recursive: true });
  const results = [];
  try {
    for (const [name, width, height, colorScheme] of (process.env.PROFILE_ONLY === 'true' ? [] : [
      ['desktop', 1440, 1100, 'light'],
      ['mobile', 390, 844, 'light'],
      ['small-mobile', 320, 700, 'light'],
      ['tablet', 768, 1024, 'light'],
      ['dark', 1440, 1100, 'dark'],
      ['dark-mobile', 390, 844, 'dark'],
    ])) {
      const page = await browser.newPage({ viewport: { width, height }, colorScheme, javaScriptEnabled: false });
      const requests = [];
      page.on('request', request => requests.push(request.url()));
      const response = await page.goto(base, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      await page.screenshot({ path: `${output}/${name}.png` });
      if (name === 'mobile') await page.screenshot({ path: `${output}/mobile-full.png`, fullPage: true });
      const rendered = await page.evaluate(() => ({
        h1: document.querySelector('h1').textContent,
        overflow: document.documentElement.scrollWidth > innerWidth,
        brokenFragments: [...document.querySelectorAll('a[href^="#"]')].filter(a => !document.getElementById(a.hash.slice(1))).map(a => a.hash),
        visibleText: document.body.innerText.length,
        images: [...document.querySelectorAll('img')].map(i => ({src: i.getAttribute('src'), alt: i.alt, width: i.naturalWidth, height: i.naturalHeight, displayedWidth: i.getBoundingClientRect().width, displayedHeight: i.getBoundingClientRect().height, dimensions: i.hasAttribute('width') && i.hasAttribute('height')})),
        privateProductLinks: [...document.querySelectorAll('#products a')].map(a => a.href),
        headingLevels: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => Number(h.tagName[1])),
        structuredData: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent),
        executableScripts: document.querySelectorAll('script:not([type="application/ld+json"])').length,
        imagesWithoutAlt: [...document.images].filter(img => !img.hasAttribute('alt')).map(img => img.src),
        structuredTypes: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'].map(entity => entity['@type']),
      }));
      assert.match(rendered.h1, /Nima Khaki/);
      assert.equal(rendered.images.length, 7, 'Seven project image placements');
      for (const img of rendered.images) {
        assert.ok(img.width > 0 && img.height > 0 && img.alt && img.dimensions, `Valid, labeled image with dimensions: ${img.src}`);
        assert.ok(img.displayedWidth <= img.width + 1, `No upscale: ${img.src}`);
        assert.ok(Math.abs(img.displayedWidth / img.displayedHeight - img.width / img.height) < 0.02, `Aspect ratio: ${img.src}`);
      }
      assert.deepEqual(rendered.privateProductLinks, [], 'No private-product outbound links');
      assert.equal(rendered.headingLevels.filter(level => level === 1).length, 1);
      rendered.headingLevels.forEach((level, i, levels) => { if (i) assert.ok(level <= levels[i - 1] + 1, 'No skipped heading levels'); });
      assert.equal(rendered.structuredData['@graph'].length, 5);
      assert.equal(rendered.executableScripts, 0, 'No executable scripts or tracking');
      if (rendered.overflow) {
        console.error(await page.evaluate(() => [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth).map(e => ({ tag: e.tagName, class: e.className, text: e.textContent.slice(0,160) }))));
      }
      assert.equal(rendered.overflow, false, `${name}: horizontal overflow`);
      assert.deepEqual(rendered.brokenFragments, []);
      assert.deepEqual(rendered.imagesWithoutAlt, []);
      assert.ok(rendered.structuredTypes.includes('Person'));
      assert.ok(rendered.structuredTypes.includes('ProfilePage'));
      assert.equal(rendered.structuredTypes.filter(type => type === 'SoftwareSourceCode').length, 3);
      for (const img of await page.locator('img').all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(el => el.decode());
      }
      await page.evaluate(() => scrollTo(0, 0));
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
    if (process.env.VERIFY_PROFILE === 'true') {
      for (const width of [320, 390, 768, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        const response = await page.goto(process.env.PROFILE_URL || 'https://github.com/Nima0101', { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200);
        const readme = page.locator('.markdown-body').filter({ hasText: 'AI-agent systems' });
        await readme.waitFor();
        assert.match(await readme.innerText(), /Created and maintained by Nima Khaki/);
        assert.match(await readme.innerText(), /UNKNOWN/);
        assert.equal(await readme.locator('img').count(), 7);
        assert.equal(await readme.locator('a').evaluateAll(links => links.filter(a => /https?:\/\/(?:www\.)?(?:bistam\.com|antagningsdata\.se|cederdalen\.com)/i.test(a.href)).length), 0, 'No private-product links');
        assert.match(await readme.innerText(), /acceptance/);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Profile page overflow');
        assert.equal(await readme.locator('img:not([alt])').count(), 0);
        for (const img of await readme.locator('img').all()) {
          await img.scrollIntoViewIfNeeded();
          await img.evaluate(el => el.decode());
        }
        await readme.screenshot({ path: `${output}/profile-${width}.png` });
        results.push({ name: `live-profile-${width}`, status: response.status(), violations: [] });
        await page.close();
      }
    }
    fs.writeFileSync(`${output}/report.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    assert.equal(results.reduce((n, r) => n + r.violations.length, 0), 0, 'Accessibility violations');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
