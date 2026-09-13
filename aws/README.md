# Flight Price Notifier AWS functions

M1 keeps application data in DynamoDB and uses Supabase only for browser authentication.

- `parser/` fetches next month's cheapest Travelpayouts fare per configured route and sends target matches to SQS.
- `parser_wrapper/` loads `routes/flight-routes.json` from S3 and invokes each parser run asynchronously.
- `notification/` consumes SQS, de-duplicates alerts in DynamoDB, and sends transactional Resend email.
- `subscriptions/save/` prepares an ECPay recurring-credit-card checkout and only records `active` after a verified callback.
- `ecpay_return/` and `ecpay_period/` validate ECPay CheckMacValue callbacks; `ecpay_result/` only redirects the browser.
- `cancel_subscription/` cancels the recurring agreement and keeps the paid period in a grace state.
- `status_notification/` is the single consumer for welcome and cancellation emails.

Runtime credentials and external API keys are read only inside Lambda from AWS Secrets Manager. They are deliberately not included in this repository or browser environment variables.

The browser requires `VITE_FLIGHT_API_URL` to point at the deployed API Gateway HTTP API. It contains no credentials and must be configured in every Vercel environment before building.

ECPay callbacks are configured on the API Gateway HTTP API. The checkout Lambda uses `PUBLIC_API_BASE_URL` and `PUBLIC_SITE_URL`; do not hardcode deployment URLs in source.
