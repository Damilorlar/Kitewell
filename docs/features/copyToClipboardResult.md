# Typed clipboard copy helper

`copyToClipboardResult` wraps `clipboard.writeText` and always returns a settled result.

Success is `{ ok: true, error: null }`. Failure is `{ ok: false, error }` with one of:

- `invalid_text` when the value is not a string
- `empty_text` when the string is empty
- `clipboard_unavailable` when `writeText` is missing
- `write_failed` when `writeText` rejects, plus `message`

```js
import { copyToClipboardResult } from "./copyToClipboardResult";

const result = await copyToClipboardResult(address);
```

Pass a clipboard object as the second argument in tests. When it is omitted, the helper uses `navigator.clipboard`.
