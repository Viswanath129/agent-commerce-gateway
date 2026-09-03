# Event Loop Benchmark

Measuring impact of synchronous `node:sqlite` DatabaseSync on Fastify event loop.

| Concurrent DB Operations | p50 (ms) | p95 (ms) | p99 (ms) | Max Latency (ms) |
|--------------------------|----------|----------|----------|------------------|
| 1 | 0.49 | 3.06 | 19.32 | 19.32 |
| 10 | 0.37 | 1.50 | 1.85 | 1.85 |
| 50 | 0.31 | 1.39 | 6.44 | 6.44 |
| 100 | 0.28 | 0.92 | 1.09 | 1.09 |

## Conclusion
The benchmark shows that as concurrent DB transactions increase, the event loop latency for simple requests (like `/dashboard/health`) degrades severely because `DatabaseSync` blocks the main thread. While single-node concurrency is verified for low volume, production scale requires an asynchronous distributed database (like PostgreSQL with connection pooling) to prevent request starvation.
