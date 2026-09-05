# Optional anomaly engine

Statistical detection first. AI is used only to explain and recommend. Off unless `FEATURE_ANOMALY_DETECTION=true`.

Controllers call `AnomalyService`. They never ask a model to decide whether a number is anomalous.

See `docs/anomaly.md`.
