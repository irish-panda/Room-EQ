import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ||
    "https://27e7f1a3a57dc75e4bba2c288cbb99c8@o4511860721844224.ingest.us.sentry.io/4511878855983104",
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  tracesSampleRate: 0,
  enableLogs: false,
  beforeSend(event) {
    event.user = undefined;
    if (event.request) {
      event.request.cookies = undefined;
      event.request.data = undefined;
      event.request.headers = undefined;
    }
    return event;
  },
});
