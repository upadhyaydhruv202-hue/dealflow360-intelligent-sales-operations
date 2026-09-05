# Reports and PDF generation

Reusable reports for summaries, tables, exports, invoices, certificates, and analytics. Hackathon-specific layouts belong under `modules/problem`.

## Pipeline

```text
Report request
  → data provider (verified facts)
  → report template
  → PDF renderer
  → StorageService
  → job status + optional notification/email
```

`generateReport({ type, data, options })` is the public service API. Long-running work is queued (`report.generate`) instead of blocking the HTTP request.

## Public HTTP API

Permission: `reports.generate`. Requires `FEATURE_PDF=true` (same flag as `POST /api/v1/pdf/generate`). See [features.md](features.md).

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/v1/reports/types` | Registered templates |
| `POST` | `/api/v1/reports/generate` | Queue or render a report |

```json
POST /api/v1/reports/generate
{
  "type": "table",
  "data": {
    "title": "Weekly export",
    "columns": ["Item", "Qty"],
    "rows": [["Widget", 3]]
  },
  "options": {
    "header": "Acme",
    "footer": "Confidential",
    "pageNumbers": true,
    "timestamp": true
  }
}
```

Default response (`202`) when a job queue is available:

```json
{
  "success": true,
  "data": { "jobId": "...", "status": "queued" },
  "meta": {}
}
```

Poll `GET /api/v1/jobs/:jobId` (`jobs.read`). Set `options.async: false` only for tiny documents or tests. The synchronous success payload includes `key`, `size`, `filename`, `type`, `title`, and a signed `download` URL.

Simple title/section PDFs remain at `POST /api/v1/pdf/generate`. See [pdf.md](pdf.md).

## Built-in types

| Type | Required data | Layout |
| --- | --- | --- |
| `simple` | `title` | Title, optional sections |
| `table` | `title`, `columns`, `rows` | Source facts (if any) + table |
| `summary` | `title`, `facts` | Verified key/value facts |
| `document` | `title` | Facts, table, optional bar chart, sections |

All types accept:

* `subtitle`
* `narrative` or `aiNarrative` — rendered in a labeled **AI-generated** block
* `options.header`, `options.footer`, `options.pageNumbers`, `options.timestamp`, `options.metadata`
* `options.filename`
* `options.notify` — in-app notification when `userId` is present
* `options.email` — `report-ready` email with a download link (PDF attached when under 1 MB)

Bar charts are drawn with pdf-lib (labels + values). They are suitable for small series, not full analytics libraries.

## Data integrity

Verified application data and AI wording stay separate.

* `data.facts` (and primitive sibling fields) are **source facts**
* `data.narrative` is **AI-generated** and never copied onto facts
* Template builders read facts for tables/key-values and only pass narrative into the labeled block
* Registered data providers are the source of truth; request fields cannot overwrite provider facts

Do not put AI totals, dates, or identifiers into `facts`. If the model invents a number, it belongs in `narrative` only.

## Background jobs

Job name: `report.generate`.

The API process and workers register the same handler. When Redis is unset they share the file queue. See [jobs.md](jobs.md).

On completion:

1. Object is stored through `StorageService` under `reports/{uuid}/{filename}`
2. Job status becomes `completed` (or `failed`)
3. `report.completed` is emitted when automation is enabled
4. Optional in-app notification (`notify: true`)
5. Optional email (`options.email`)

Notification or email failure does not delete the stored PDF.

## How to add a report type

Keep problem-specific templates out of `backend/src/integrations/reports`. Register them from `modules/problem` (or `createApp({ reportRegistry })`).

```ts
import { createDefaultReportRegistry } from '../backend/src/integrations/reports';

const registry = createDefaultReportRegistry();

registry.registerTemplate({
  type: 'low-stock',
  description: 'Warehouse items below threshold',
  requiredFactKeys: ['title', 'warehouse'],
  build(dataset, options) {
    return {
      title: dataset.title,
      header: { text: options.header ?? dataset.title, timestamp: true },
      footer: { pageNumbers: true },
      blocks: [
        { type: 'heading', text: dataset.title, level: 1 },
        { type: 'facts', entries: [{ key: 'warehouse', value: dataset.facts.warehouse }] },
        dataset.table
          ? { type: 'table', columns: dataset.table.columns, rows: dataset.table.rows }
          : { type: 'paragraph', text: 'No rows' },
      ],
    };
  },
});

registry.registerDataProvider('low-stock', async ({ data }) => {
  const warehouse = String(data.warehouseId ?? '');
  const rows = await inventory.findLowStock(warehouse); // verified DB data
  return {
    title: 'Low stock',
    facts: { warehouse },
    narrative: null,
    table: { columns: ['Sku', 'Qty'], rows },
    chart: null,
    sections: [],
  };
});
```

Then pass `reportRegistry: registry` into `createApp`. The new type appears on `GET /api/v1/reports/types`.

Rules:

1. Fetch source records in the data provider, not the template
2. Put AI copy only on `narrative`
3. Reuse `facts`, `table`, `chart`, and `narrative` blocks instead of drawing in the controller
4. Do not import `pdf-lib` from `modules/problem`

## Service

```ts
await reports.generateReport({ type, data, options, userId? })
reports.listTypes()
reports.getRegistry().registerTemplate(...)
```

## Tests

Unit tests cover a simple report, a table report, missing data, renderer failure, storage failure, background job failure, and fact/narrative separation. HTTP tests cover RBAC, `202` enqueue, and job completion.

## Limitations

* Charts are simple bar drawings (no pie/line libraries). That is enough for small series in a PDF.
* Helvetica uses WinAnsi: Western European text is kept; other scripts are replaced with `?`. Embedding a Unicode font is left to a problem module if needed.
* Tables are capped (200 rows, 12 columns) so a report cannot exhaust memory.
* Sync generation (`options.async: false`) is for tests and tiny documents only.
* Emailed download links expire after 24 hours. Small PDFs are also attached.
