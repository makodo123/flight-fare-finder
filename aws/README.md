# Flight Price Notifier AWS functions

M1 keeps application data in DynamoDB and uses Supabase only for browser authentication.

- `parser/` fetches next month's cheapest Travelpayouts fare per configured route and sends target matches to SQS.
- `parser_wrapper/` loads `routes/flight-routes.json` from S3 and invokes each parser run asynchronously.
- `notification/` consumes SQS, de-duplicates alerts in DynamoDB, and sends transactional Resend email.

Runtime credentials and external API keys are read only inside Lambda from AWS Secrets Manager. They are deliberately not included in this repository or browser environment variables.

The browser requires `VITE_FLIGHT_API_URL` to point at the deployed API Gateway HTTP API. It contains no credentials and must be configured in every Vercel environment before building.
