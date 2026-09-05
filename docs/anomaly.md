# Optional anomaly engine

Statistical insight engine for numeric series. Detection is deterministic. AI is used only to explain a finding and suggest a human review step.

The module is **off by default**. Enable `FEATURE_ANOMALY_DETECTION=true` only when a problem statement needs it.

See `backend/src/anomaly/` for the implementation.

## Pipeline

```text
Data (metric series)
 → statistical detectors
 → anomaly verdict (measured)
 → optional AI explanation + recommendation
 → persist finding
 → anomaly.detected event
 → notification / email / report / workflow
```

```text
Controller (HTTP + zod + authenticate + requirePermission("anomaly.use"))
        │
        ▼
AnomalyService
        │
        ├── detectors (threshold, percent change, moving average, frequency, trend, z-score)
        ├── AnomalyStore (memory | postgres)
        └── AIService.generateStructured (explanation only; never changes the verdict)
```

Do not ask a model whether a number is anomalous. Do not execute AI output. `evidence.claimsStatisticalSignificance` is always `false`: z-score is a descriptive outlier flag, not a hypothesis test.

## Enable

| Variable | Default | Notes |
| --- | --- | --- |
| `FEATURE_ANOMALY_DETECTION` | `false` | Turns the HTTP API, service, Copilot `detectAnomaly` tool, and `anomaly.evaluate` job on |
| `FEATURE_AI` / `AI_ENABLED` | `false` | Optional. When AI is ready, findings can include an explanation. Detection still runs without it |
| `FEATURE_AUTOMATION` | `false` | When on, `anomaly.detected` is emitted for matching rules |
| `FEATURE_NOTIFICATIONS` | `false` | When on, `notify: true` creates an in-app notification for the caller |
| `ANOMALY_ZSCORE_MIN_SAMPLES` | `8` | Baseline points required before z-score / frequency z-score run |
| `ANOMALY_ZSCORE_THRESHOLD` | `2` | Descriptive \|z\| floor |
| `ANOMALY_ZSCORE_HIGH` | `3` | Descriptive \|z\| for HIGH |
| `ANOMALY_PERCENT_CHANGE_LOW` | `10` | Percent-change LOW |
| `ANOMALY_PERCENT_CHANGE_MEDIUM` | `15` | Percent-change MEDIUM |
| `ANOMALY_PERCENT_CHANGE_HIGH` | `20` | Percent-change HIGH |
| `ANOMALY_MOVING_AVERAGE_WINDOW` | `5` | SMA window (excluding the latest point) |
| `ANOMALY_MOVING_AVERAGE_DEVIATION_PCT` | `15` | SMA deviation floor |
| `ANOMALY_TREND_WINDOW` | `5` | Slope window for trend-change |
| `ANOMALY_MAX_POINTS` | `500` | Hard cap on series length (request schema also caps at 500) |
| `ANOMALY_EXPLAIN` | `true` | Default for `explain` on evaluate. Still skipped when there is no anomaly or AI is not ready |

After migrating, re-seed or assign `anomaly.use` so manager/admin receive the new permission.

Without `DATABASE_URL`, findings stay in process memory. With Postgres, they persist in `anomaly_findings`.

## HTTP API

Prefix `/api/v1`. Bearer token and `anomaly.use` required (manager and admin by default). AI rate limits apply.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/anomalies/evaluate` | Run detectors, optionally explain, persist (`200`, or `202` when `async: true`) |
| GET | `/anomalies` | List the caller's findings (`page`, `pageSize`, `metric`, `anomaly`) |
| GET | `/anomalies/:id` | One finding the caller created, including the series snapshot |

Evaluate body:

```json
{
  "metric": "sales",
  "points": [100, 101, 99, 102, 98, 100, 101, 99, 100, 76.6],
  "explain": true,
  "notify": false,
  "async": false,
  "detectors": {
    "percentChange": { "window": 1 },
    "zScore": { "minSamples": 8, "threshold": 2 }
  }
}
```

`points` may also be `{ "t": "2026-08-01T00:00:00.000Z", "value": 100 }` objects. Frequency detectors treat non-negative values as counts.

Response (measured fields are never taken from the model):

```json
{
  "metric": "sales",
  "anomaly": true,
  "severity": "HIGH",
  "change": -23.4,
  "evidence": {
    "sampleSize": 10,
    "latest": 76.6,
    "baseline": 100,
    "change": -23.4,
    "fired": ["percentChange", "movingAverage", "zScore"],
    "skipped": [],
    "sufficientSample": true,
    "claimsStatisticalSignificance": false,
    "insufficientData": false
  },
  "explanation": "...",
  "recommendedAction": "...",
  "explanationStatus": "generated"
}
```

`explanationStatus` is `generated`, `skipped` (no anomaly / insufficient data / `explain: false`), `failed` (model error; evidence is kept), or `unavailable` (AI not ready).

If every requested detector is skipped for lack of data, `anomaly` is false and `evidence.insufficientData` is true. The service does **not** invent a significant result.

## Detectors

| Detector | What it measures | Skips when |
| --- | --- | --- |
| `threshold` | Latest vs optional min/max | No min/max configured |
| `percentChange` | Latest window mean vs prior window mean | Fewer than `2 * window` points |
| `movingAverage` | Latest vs SMA of the previous `window` points | Fewer than `window + 1` points |
| `frequency` | Count spike vs expected range or descriptive z-score | Negatives, or too few prior counts |
| `trend` | Sign flip between prior and recent linear slopes | Fewer than `2 * window` points |
| `zScore` | Latest vs sample mean/stdev of the baseline | Baseline shorter than `ANOMALY_ZSCORE_MIN_SAMPLES`, or zero variance |

Disable a detector with `{ "enabled": false }`.

## Automation

When `FEATURE_AUTOMATION` is on and `anomaly` is true, the service emits `anomaly.detected` with:

```json
{
  "findingId": "...",
  "metric": "sales",
  "anomaly": true,
  "severity": "HIGH",
  "change": -23.4,
  "userId": "...",
  "title": "HIGH anomaly on sales",
  "body": "sales changed -23.4% (HIGH)."
}
```

Example rule: notify, email, generate a PDF, or enqueue `anomaly.evaluate` / `report.generate`.

```json
{
  "name": "Alert on high anomalies",
  "trigger": "anomaly.detected",
  "enabled": true,
  "conditions": [{ "field": "severity", "operator": "equals", "value": "HIGH" }],
  "actions": [
    { "type": "sendNotification", "title": "{{title}}", "body": "{{body}}", "userIdField": "userId", "notificationType": "warning" },
    { "type": "sendEmail", "template": "alert", "to": "ops@example.com" },
    { "type": "generatePDF", "title": "Anomaly {{metric}}", "sections": [{ "lines": ["{{body}}"] }] }
  ]
}
```

Set `notify: true` on evaluate to also write an in-app notification when `FEATURE_NOTIFICATIONS` is on.

## Copilot

When the module is on, Copilot registers `detectAnomaly` (`anomaly.use`, low risk). The tool returns the same measured verdict; it does not let the planner invent numbers.

## Security

- Series values are numbers (schema-validated). Explanation prompts wrap evidence with `wrapUntrustedData`.
- AI output cannot change `anomaly`, `severity`, `change`, or `evidence`.
- Recommended actions are advisory. They are not executed.
- Findings never store secrets. Audit writes `anomaly.evaluate` without the full series.

## Tests

Deterministic fixtures in `backend/src/anomaly/fixtures.ts`:

* no anomaly (stable series)
* low anomaly (percent-change only)
* high anomaly (−23.4% drop)
* insufficient data (z-score skipped)
* AI explanation failure (evidence kept, `explanationStatus: failed`)

HTTP tests: `backend/tests/anomaly.http.test.ts`. Postgres: `backend/tests/anomaly.db.test.ts` (skipped without `DATABASE_URL`).

## Limitations

* This is not a streaming time-series database or a seasonal/STL model. Windowed SMA, percent change, slope sign-flip, and z-score cover hackathon-scale series.
* Z-score is not a p-value. Do not report “statistically significant” from this module.
* Memory store is process-local. Use Postgres so the API and workers share findings.
* Problem modules should POST their own metrics. The kit does not scrape Odoo or the database for business KPIs.
