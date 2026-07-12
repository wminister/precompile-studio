const productionUrl = process.env.PRODUCTION_URL ?? "https://precompile-studio.vercel.app";
const consumerAddress = "0x30a2132b7f47a30e2d55a191f6723161c232263c";
const attempts = 6;

async function check() {
  const response = await fetch(productionUrl, { redirect: "follow" });
  if (!response.ok) throw new Error(`home returned HTTP ${response.status}`);
  const html = await response.text();
  if (!html.includes("<title>Precompile Studio</title>")) throw new Error("home title is missing");
  const scriptPath = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
  if (!scriptPath) throw new Error("production JavaScript asset is missing");
  const script = await fetch(new URL(scriptPath, response.url)).then((asset) => asset.text());
  if (!script.toLowerCase().includes(consumerAddress)) throw new Error("owned consumer is not in production bundle");

  const faq = await fetch(new URL("/faq", response.url));
  if (!faq.ok) throw new Error(`FAQ returned HTTP ${faq.status}`);
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    await check();
    console.log(JSON.stringify({ ok: true, productionUrl, consumerAddress }));
    process.exit(0);
  } catch (error) {
    lastError = error;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}

throw lastError;
