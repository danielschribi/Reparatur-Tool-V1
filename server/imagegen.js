const puppeteer = require('puppeteer');


async function htmlToJpeg({ html, width = 800, height = 1000 }) {
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle0' });
const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true });
await browser.close();
return buffer;
}


module.exports = { htmlToJpeg };
