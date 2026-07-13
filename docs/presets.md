# Recipe Preset JSON

Precompile Studio recipe presets are small JSON documents that store composer field values for a matching recipe tab. They are meant for local reuse, sharing examples, and moving a working request between browsers.

The importer accepts either:

- a wrapper object with one `preset`
- a wrapper object with `presets`
- a raw preset object
- an array of raw preset objects

## Single Preset Wrapper

```json
{
  "version": 1,
  "preset": {
    "id": "http-200-echo",
    "recipeId": "http",
    "label": "HTTP 200 echo",
    "updatedAt": 1783110000000,
    "fields": [
      { "key": "executor", "value": "0x0000000000000000000000000000000000000000" },
      { "key": "method", "value": "GET" },
      { "key": "ttl", "value": "30" },
      { "key": "url", "value": "https://httpbin.org/get" },
      { "key": "headers", "value": "accept: application/json" },
      { "key": "body", "value": "" }
    ]
  }
}
```

## Field Rules

- `recipeId` must match a known recipe tab, currently `http`, `llm`, `jq`, `agent`, or `scheduler`.
- Imported `fields` can be minimal `key` and `value` pairs.
- The app normalizes imported fields against the current recipe schema, so labels, select controls, textarea controls, and option lists stay consistent.
- Unknown field keys are ignored.
- Missing known field keys fall back to that recipe's default value.
- Imported preset ids are replaced locally to avoid collisions.

## Examples

- [`examples/http-preset.json`](../examples/http-preset.json) stores a GET request for HTTP precompile `0x0801`.
- [`examples/llm-preset.json`](../examples/llm-preset.json) stores a GLM-4.7 chat-completion draft for LLM precompile `0x0802`. Replace the zero executor with a registered TEE executor before encoding.
- [`examples/jq-preset.json`](../examples/jq-preset.json) stores a synchronous JSON price extraction for JQ precompile `0x0803`.
- [`examples/agent-preset.json`](../examples/agent-preset.json) stores a Sovereign Agent CLI run draft for precompile `0x080C`. Replace the zero executor and callback address before encoding.
- [`examples/scheduler-preset.json`](../examples/scheduler-preset.json) stores a Scheduled JQ price transform. The studio discovers or creates the connected wallet's consumer, calculates the Scheduler reserve and execution budget, and funds any escrow shortfall atomically when the owner submits it.

## Safety

Preset JSON is data only. It should not include private keys, seed phrases, wallet secrets, bearer tokens, or paid API keys. If a request needs authenticated headers, prefer short-lived test credentials and rotate them after sharing.
