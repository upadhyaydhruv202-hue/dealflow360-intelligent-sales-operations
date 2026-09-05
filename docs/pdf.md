# PDF

Low-level PDF renderer used by `PdfService` and `ReportService`. Output is stored through `StorageService`.

For reports, invoices, certificates, tables, charts, and async jobs, use [reports.md](reports.md) (`POST /api/v1/reports/generate`).

## Public HTTP API

`POST /api/v1/pdf/generate` — permission `reports.generate`. Requires `FEATURE_PDF=true`.

```json
{
  "title": "Weekly summary",
  "sections": [{ "heading": "Notes", "lines": ["All clear"] }],
  "async": false
}
```

Success `data` includes `key`, `size`, `contentType`, `filename`, and a time-limited `download` URL (`GET /api/v1/storage/download`).

Job name: `pdf.generate`. Async requests return `{ queued: true, key, filename, jobId }`.

Simple PDFs include a timestamp header and page numbers. Do not put hackathon-specific layouts here.

## Service

```ts
await pdf.generate({ title, sections, filename?, async? })
```

The renderer (`renderPdfDocument`) supports headers, footers, tables, facts, bar charts, and labeled AI narrative blocks. `ReportService` is the orchestration layer that maps report types onto that renderer.
