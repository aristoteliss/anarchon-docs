---
title: Worker service
description: A .NET worker service that runs scheduled jobs, with jobs from dependency injection, configuration from appsettings.json, and a clean stop on SIGTERM.
sidebar:
  badge: '.NET'
---

A worker service is a .NET app with a host but no web server: the natural home for jobs that should
run apart from the processes that serve requests. The host starts the scheduler, and stops it on
`SIGTERM` or Ctrl+C.

## Create it

```sh
dotnet new worker -n Reports
cd Reports
dotnet add package Anarchon.Redis
```

Delete the `Worker.cs` the template made; the scheduler takes its place.

## Program.cs

```csharp
using Anarchon;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddScoped<IReportStore, ReportStore>();
builder.Services
    .AddAnarchon(options => options.TimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Athens"))
    .UseRedis(options =>
    {
        options.Configuration = builder.Configuration.GetConnectionString("redis");
        options.Prefix = "reports:cron:";
    })
    .AddJobs<ReportJobs>();

var app = builder.Build();
var scheduler = app.Services.GetRequiredService<Scheduler>();
scheduler.Failed += (_, run) => app.Services.GetRequiredService<ILogger<Program>>().LogError(run.Cause, "{Job} failed", run.Job);

await app.RunAsync();
```

## The jobs

```csharp
public sealed class ReportJobs(IReportStore store, ILogger<ReportJobs> logger)
{
    [Every("10s", Name = "refresh-cache", Timeout = "8s")]
    public async Task RefreshCacheAsync(JobContext ctx)
    {
        logger.LogInformation("refreshing the cache for {Due:HH:mm:ss} on {Instance}", ctx.ScheduledAt, ctx.InstanceId);
        await Task.Delay(200, ctx.CancellationToken);
    }

    [Cron("0 8 * * 1-5", Name = "weekday-digest")]
    public Task SendDigestAsync(JobContext ctx) => store.SaveAsync($"digest for {ctx.ScheduledAt:yyyy-MM-dd}", ctx.CancellationToken);

    [Cron("*/30 * * * * *", Name = "half-minute-report", MaxAttempts = 2)]
    public Task ReportAsync(JobContext ctx) => store.SaveAsync($"report {ctx.Slot} (attempt {ctx.Attempt}, {ctx.Reason})", ctx.CancellationToken);
}
```

Each run gets a new service scope and a new `ReportJobs` from it, so the class can take scoped
services. [Attributes](../../guides/attributes/) lists every property.

## Configuration

The connection string comes from configuration, so it never sits in code:

```json
{
  "ConnectionStrings": {
    "redis": "localhost:6379"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Anarchon.Scheduler": "Debug"
    }
  }
}
```

In production, set it from the environment (`ConnectionStrings__redis`) or a secret store. At the
`Debug` level the scheduler logs every run it starts and finishes; at `Information` it logs only
what goes wrong.

## Run several

Start the worker in three terminals. Every scheduled time runs on one of them; stop one with Ctrl+C
and the others carry on. On a lease backend, a job that was running is handed over within two
heartbeats.

```sh
dotnet run
```

## Stopping

The host stops the scheduler when it receives `SIGTERM` (Docker, Kubernetes, systemd) or Ctrl+C:

1. Running jobs see `ctx.CancellationToken` cancelled.
2. A job that throws then is handed over to another instance at once.
3. The host waits up to `StopTimeout` (30 seconds), and no longer than its own `ShutdownTimeout`.

Jobs that pass the token on to every call they make stop in time. See
[Writing handlers](../../guides/writing-handlers/) and [Long-running jobs](../long-running-jobs/).

## In a container

```dockerfile
FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app
COPY bin/Release/net10.0/publish/ .
ENTRYPOINT ["dotnet", "Reports.dll"]
```

`ENTRYPOINT` in this form makes `dotnet` the process that receives `SIGTERM`. Give each container
its name as `InstanceId`, so history shows which one ran each run:

```csharp
builder.Services.AddAnarchon(options => options.InstanceId = Environment.GetEnvironmentVariable("POD_NAME"));
```

## As a systemd service

```sh
dotnet add package Microsoft.Extensions.Hosting.Systemd
```

```csharp
builder.Services.AddSystemd();
```

`systemctl stop` then sends `SIGTERM` and waits for the host. Keep `TimeoutStopSec` above
`StopTimeout`.

## Run the example

The [`Hosting` example](https://github.com/aristoteliss/anarchon-dotnet/tree/main/examples/Hosting) is
this worker:

```sh
dotnet run --project examples/Hosting
```

## Next

- [ASP.NET Core](../aspnet-core/): jobs in a web app, with endpoints
- [Rolling deploys on Kubernetes](../kubernetes/)
- [Hosting reference](../../reference/dotnet/hosting/)
