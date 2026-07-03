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
    "id": "http-github-example",
    "recipeId": "http",
    "label": "GitHub repo metadata",
    "updatedAt": 1783110000000,
    "fields": [
      { "key": "executor", "value": "0x0000000000000000000000000000000000000000" },
      { "key": "method", "value": "GET" },
      { "key": "ttl", "value": "30" },
      { "key": "url", "value": "https://api.github.com/repos/ritual-net/infernet-ml" },
      { "key": "headers", "value": "accept: application/json" },
      { "key": "body", "value": "" }
    ]
  }
}
```

## Field Rules

- `recipeId` must match a known recipe tab, currently `http`, `llm`, `agent`, or `scheduler`.
- Imported `fields` can be minimal `key` and `value` pairs.
- The app normalizes imported fields against the current recipe schema, so labels, select controls, textarea controls, and option lists stay consistent.
- Unknown field keys are ignored.
- Missing known field keys fall back to that recipe's default value.
- Imported preset ids are replaced locally to avoid collisions.

## Safety

Preset JSON is data only. It should not include private keys, seed phrases, wallet secrets, bearer tokens, or paid API keys. If a request needs authenticated headers, prefer short-lived test credentials and rotate them after sharing.
