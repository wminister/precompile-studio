import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

await page.setContent(`
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; }
        html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
        body {
          display: grid;
          place-items: center;
          color: #f8f7f2;
          background:
            radial-gradient(circle at 50% -260px, rgba(116, 94, 164, 0.24), transparent 520px),
            linear-gradient(180deg, #08070b 0%, #050506 100%);
          font-family: Barlow, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        main { display: grid; width: 1080px; gap: 42px; }
        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 22px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.13);
        }
        .brand { display: flex; align-items: center; gap: 16px; font-size: 24px; font-weight: 600; }
        .mark { display: grid; grid-template-columns: repeat(2, 15px); gap: 4px; }
        .mark span { width: 15px; height: 15px; border: 2px solid #f8f7f2; }
        .mark span:nth-child(2) { transform: translateY(-8px); }
        .beta {
          color: rgba(248, 247, 242, 0.58);
          font-family: "SFMono-Regular", "Geist Mono", monospace;
          font-size: 15px;
        }
        h1 { max-width: 780px; margin: 0; font-size: 64px; line-height: 1.03; font-weight: 500; letter-spacing: 0; }
        p { max-width: 760px; margin: 20px 0 0; color: rgba(248, 247, 242, 0.64); font-size: 25px; line-height: 1.42; }
        .states {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          border: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 8px;
          background: rgba(20, 20, 28, 0.72);
        }
        .states div { display: grid; gap: 7px; padding: 18px 22px; }
        .states div + div { border-left: 1px solid rgba(255, 255, 255, 0.11); }
        .states span { color: rgba(248, 247, 242, 0.48); font-size: 13px; font-weight: 600; text-transform: uppercase; }
        .states strong { font-family: "SFMono-Regular", "Geist Mono", monospace; font-size: 18px; font-weight: 500; }
        .available { color: #8ff0c4; }
        .degraded { color: #f7c66f; }
        .preview { color: rgba(248, 247, 242, 0.72); }
      </style>
    </head>
    <body>
      <main>
        <header>
          <div class="brand">
            <span class="mark" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
            Precompile Studio
          </div>
          <span class="beta">RITUAL TESTNET BETA</span>
        </header>
        <section>
          <h1>Compose Ritual calls with the evidence visible.</h1>
          <p>Prepare calldata, resolve wallet and chain checks, submit supported flows, and inspect the resulting trace.</p>
        </section>
        <section class="states">
          <div><span>Available</span><strong class="available">HTTP · JQ · Scheduled JQ</strong></div>
          <div><span>Executor state</span><strong class="degraded">LLM degraded</strong></div>
          <div><span>Agent</span><strong class="preview">Inspection only</strong></div>
        </section>
      </main>
    </body>
  </html>
`);

await page.screenshot({ path: "public/og-image.png", type: "png" });
await browser.close();
