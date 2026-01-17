import { NodeSdk } from "@effect/opentelemetry"
import { SentrySpanProcessor } from "@sentry/opentelemetry"
import {
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
} from "@opentelemetry/sdk-logs"

export const TelemetryLayer = NodeSdk.layer(() => {
  const environment = process.env.NODE_ENV || "development"
  const serviceVersion = process.env.npm_package_version || "1.0.0"

  return {
    resource: {
      serviceName: "truckapp",
      serviceVersion,
      attributes: {
        "deployment.environment": environment,
      },
    },

    // Sentry receives all spans via OpenTelemetry bridge
    spanProcessor: new SentrySpanProcessor(),

    // Logs go to console (Sentry captures as breadcrumbs)
    logRecordProcessor: new BatchLogRecordProcessor(
      new ConsoleLogRecordExporter()
    ),

    // Shutdown timeout for serverless
    shutdownTimeout: "5 seconds",
  }
})
