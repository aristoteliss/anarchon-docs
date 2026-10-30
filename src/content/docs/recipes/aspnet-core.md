---
title: ASP.NET Core
description: A scheduler in an ASP.NET Core app, started and stopped with it, with jobs from dependency injection and endpoints to list jobs, read history and run a job now.
sidebar:
  badge: '.NET'
---

In an ASP.NET Core app the scheduler is a service. `AddAnarchon()` registers it, the host starts it
with the app and stops it on shutdown, and `AddJobs<T>()` adds the jobs declared on a class with
[attributes](../../guides/attributes/). Each run gets a service scope of its own, so jobs can take
scoped services such as a `DbContext`.

This is the .NET counterpart of the [Express](../express/) and [NestJS](../nestjs/) recipes.

## Install

```sh
dotnet add package Anarchon.Postgres   # or Anarchon.Redis, Anarchon.Sqlite, Anarchon.RabbitMQ, Anarchon.Nats
```

Each backend package brings `Anarchon` and the `UsePostgres()`, `UseRedis()` (and so on) methods.

## Program.cs

```csharp
using System.Text.Json.Serialization;
using Anarchon;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddNpgsqlDataSource(builder.Configuration.GetConnectionString("app")!);
builder.Services.AddScoped<Mailer>();
builder.Services
    .AddAnarchon(options =>
    {
        options.InstanceId = Environment.GetEnvironmentVariable("POD_NAME"); // or leave the default, host:pid
        options.TimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Athens");
    })
    .UsePostgres((services, options) => options.DataSource = services.GetRequiredService<NpgsqlDataSource>())
    .AddJobs<ReportJobs>();

builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddHealthChecks().AddCheck<CronHealthCheck>("cron");

var app = builder.Build();

var jobs = app.MapGroup("/jobs");
jobs.MapGet("/", (Scheduler scheduler) => scheduler.GetJobs());
jobs.MapGet("/{name}/runs", (string name, int? limit, Scheduler scheduler) => scheduler.HistoryAsync(name, limit ?? 20));
jobs.MapGet("/{name}/last", async (string name, Scheduler scheduler) =>
    await scheduler.LastRunAsync(name) is { } run ? Results.Ok(run) : Results.NotFound());
jobs.MapPost("/{name}/run", async (string name, Scheduler scheduler) =>
{
    try
    {
        return Results.Ok(await scheduler.RunNowAsync(name)); // answers once the run has finished
    }
    catch (AnarchonException error) when (error.Code == AnarchonErrorCode.UnknownJob)
    {
        return Results.NotFound(error.Message);
    }
}).RequireAuthorization("admin");

app.MapHealthChecks("/health");
app.Run();
```

What each part does:

| Call | Effect |
| --- | --- |
| `AddAnarchon(options => ...)` | Registers one `Scheduler` as a singleton, and a hosted service that starts and stops it. The options are [`SchedulerOptions`](../../reference/dotnet/options/) |
| `UsePostgres(...)` | The backend. The `(services, options)` form takes clients from the container; the string form takes a connection string |
| `AddJobs<ReportJobs>()` | Registers `ReportJobs` as scoped, and adds every job its attributes declare |
| `Scheduler` in a handler | The same singleton: endpoints read history and start runs through it |

The scheduler's log goes to the app's logging, under the category `Anarchon.Scheduler`. See
[Events and logging](../../guides/events-and-logging/).

## The jobs

```csharp
public sealed class ReportJobs(NpgsqlDataSource db, Mailer mailer, ILogger<ReportJobs> logger)
{
    [Cron("0 8 * * 1-5", Name = "weekday-digest")]
    public async Task DigestAsync(JobContext ctx)
    {
        await using var command = db.CreateCommand("SELECT count(*) FROM orders WHERE created_at >= $1");
        command.Parameters.AddWithValue(ctx.ScheduledAt.AddDays(-1));
        var orders = (long)(await command.ExecuteScalarAsync(ctx.CancellationToken))!;
        await mailer.SendAsync($"{orders} orders yesterday", ctx.CancellationToken);
    }

    [Every("10s", Name = "sync", Timeout = "8s")]
    public Task SyncAsync(JobContext ctx)
    {
        logger.LogInformation("sync {Slot} on {Instance}", ctx.Slot, ctx.InstanceId);
        return Task.Delay(100, ctx.CancellationToken);
    }
}
```

A new `ReportJobs` is created for each run, from a new scope, and disposed of after it. Keep no state
in its fields between runs; [run data](../../guides/run-data/) and the store are the places for that.

## Start-up and shutdown

- **Start-up.** The hosted service calls `StartAsync()` before the app takes requests. If the store is
  unreachable, start-up fails, and so does the app: a pod that can't reach its store is not ready.
- **Shutdown.** On `SIGTERM` or Ctrl+C the host stops the scheduler. Running jobs see their token
  cancelled; on a lease backend a job that throws then is handed to another instance at once. The
  wait is `StopTimeout` (30 seconds), and no longer than the host's `ShutdownTimeout`. See
  [Rolling deploys on Kubernetes](../kubernetes/).

## The endpoints

| Endpoint | Calls | Notes |
| --- | --- | --- |
| `GET /jobs` | `GetJobs()` | Jobs registered on this instance, with their next run |
| `GET /jobs/{name}/runs` | `HistoryAsync(name, limit)` | Runs from every instance, newest first |
| `GET /jobs/{name}/last` | `LastRunAsync(name)` | The latest run, or 404 |
| `POST /jobs/{name}/run` | `RunNowAsync(name)` | Runs the job here and answers when it finished. Protect it: `"admin"` stands for an authorization policy of yours |

`JsonStringEnumConverter` makes statuses and reasons read as `"Success"` and `"Takeover"` rather than
numbers.

## The health check

`CronHealthCheck` asks the store, not this instance, when `sync` last ran. It passes on every
instance as long as some instance runs the job, which is what a load balancer should see. Don't
use it for liveness: a failing job is an alert, not a reason to restart pods.

```csharp
public sealed class CronHealthCheck(Scheduler scheduler) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var last = await scheduler.LastRunAsync("sync", cancellationToken);
        var age = last is null ? TimeSpan.MaxValue : DateTimeOffset.UtcNow - last.StartedAt;
        var ok = last?.Status != RunStatus.Failed && age < TimeSpan.FromSeconds(30); // "sync" runs every 10 s
        return ok ? HealthCheckResult.Healthy() : HealthCheckResult.Unhealthy($"last sync: {last?.Status}, {age} ago");
    }
}
```

## Jobs in code instead of attributes

Jobs can also be added in code, once the app is built and before it runs:

```csharp
var app = builder.Build();
app.Services.GetRequiredService<Scheduler>()
    .Every("sync", TimeSpan.FromSeconds(10), ctx => Task.Delay(100, ctx.CancellationToken))
    .Cron("digest", "0 8 * * 1-5", SendDigestAsync);
```

Such handlers run on the scheduler's thread pool, outside any scope: create one yourself with
`IServiceScopeFactory` when a job needs scoped services.

## Several schedulers

`AddAnarchon("name")` registers a keyed scheduler, for jobs on another store or with other lease
timings. Each has its own backend and jobs, and the host starts and stops all of them:

```csharp
builder.Services.AddAnarchon("billing").UseRedis(builder.Configuration.GetConnectionString("billing")!).AddJobs<BillingJobs>();

app.MapGet("/billing/jobs", ([FromKeyedServices("billing")] Scheduler billing) => billing.GetJobs());
```

## Run it

The [`HttpApi` example](https://github.com/aristoteliss/anarchon-dotnet/tree/main/examples/HttpApi)
is a smaller version of this app, on a SQLite file by default:

```sh
dotnet run --project examples/HttpApi
curl localhost:3000/jobs
curl -X POST localhost:3000/jobs/sync/run
```

Start it twice (`PORT=3001` for the second) and the runs spread over both instances.

## Next

- [Worker service](../worker-service/): the same without a web server
- [A worker process and a read-only API](../worker-and-api/)
- [Hosting reference](../../reference/dotnet/hosting/)
