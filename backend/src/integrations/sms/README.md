# SMS

Provider-agnostic SMS. Call `SmsService` from services and jobs. Do not import Twilio, Vonage, or other vendor SDKs from controllers or `modules/problem`.

* Demo mode, tests, and `SMS_PROVIDER=mock` record messages in memory.
* `SMS_ENABLED=true` or `FEATURE_SMS=true` with `SMS_PROVIDER=http` POSTs JSON to `SMS_HTTP_URL`.
* Job name: `sms.send`

See `docs/sms.md`.
