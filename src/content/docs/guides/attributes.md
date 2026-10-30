---
title: Attributes (.NET)
description: Declare jobs on the methods of a class with [Cron], [Every] and [At], add them with Register() or, in a host, AddJobs<T>(), which runs each job in a service scope of its own.
---

In .NET, jobs can be declared on the methods of a class with `[Cron]`, `[Every]` and `[At]`, instead
of being passed to `Cron()`, `Every()` and `At()`. In Node.js the same idea is
[decorators](../decorators/), with a different way of adding the jobs.

```csharp
public sealed class ReportJobs(ReportsDbContext db, IMailer mailer)
{
    [Cron("0 8 * * 1-5", Name = "weekday-digest", TimeZone = "Europe/Athens")]
    public async Task DigestAsync(JobContext ctx) =>
        await mailer.SendAsync(await db.BuildDigestAsync(ctx.ScheduledAt, ctx.CancellationToken), ctx.CancellationToken);

    [Every("10s", Name = "sync-customers", Timeout = "8s")]
    public Task SyncAsync(CancellationToken cancellationToken) => db.SyncCustomersAsync(cancellationToken);

    [At("2026-12-01T09:00:00Z", Name = "announce-launch")]
    public Task AnnounceAsync(CancellationToken cancellationToken) => mailer.SendAsync("We are live", cancellationToken);
}
```

## Adding the jobs

There are two ways, and both add every job of the class or none.

**With a host** (ASP.NET Core, a worker service), `AddJobs<T>()` registers the class as a scoped
service. Each run gets a new service scope and a new object from it, so the class can take scoped
services such as a `DbContext`:

```csharp
builder.Services
    .AddAnarchon(options => options.TimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Athens"))
    .UseRedis(builder.Configuration.GetConnectionString("redis")!)
    .AddJobs<ReportJobs>();
```

The host starts the scheduler, and stops it on shutdown. See [ASP.NET Core](../../recipes/aspnet-core/)
and [Worker service](../../recipes/worker-service/).

**Without a host**, `Register(object)` adds the jobs of one object, which runs every job:

```csharp
await using var scheduler = new Scheduler(new SchedulerOptions { Backend = backend });
scheduler.Register(new ReportJobs(db, mailer));
await scheduler.StartAsync();
```

## The three attributes

| Attribute | The schedule | Like |
| --- | --- | --- |
| `[Every("10s")]` | An interval on the UTC grid, as text: `"10s"`, `"35m"`, `"1h30m"`, `"2d"` | `Every()` |
| `[Cron("0 8 * * 1-5")]` | A cron expression, 5 fields or 6 with seconds first | `Cron()` |
| `[At("2026-12-01T09:00:00Z")]` | One time, as ISO 8601 text (UTC unless it says otherwise) | `At()` |

Every option of a job is a property of the attribute. Durations are text, read by `Duration.Parse`
(`"30s"`, `"1h30m"`, `"500ms"`):

| Property | On | Means |
| --- | --- | --- |
| `Name` | all | The job's name. Default `Type-Method`, such as `ReportJobs-SyncAsync` |
| `Jitter`, `MaxLate`, `Timeout`, `HistoryTtl`, `CatchUp` | all | As the [job options](../job-options/). `Jitter = "0s"` and `CatchUp = "0s"` turn them off |
| `HistorySize`, `MaxAttempts`, `YieldAfterFailure` | all | As the job options |
| `Overlap` | `[Every]`, `[Cron]` | `OverlapPolicy.Skip` (default) or `OverlapPolicy.Allow` |
| `TimeZone` | `[Cron]` | An IANA name such as `"Europe/Athens"` |
| `Offset` | `[Every]` | Shifts the grid, such as `"30m"` |

A property left out takes the value of `RegisterOptions.Defaults`, then of the scheduler.

## The methods

A job method is a public instance method of the class, inherited ones included. It returns `Task`,
`ValueTask` or nothing, and takes any of `JobContext` and `CancellationToken`, in any order:

```csharp
[Every("1m")] public Task RunAsync(JobContext ctx) => ...;
[Every("1m")] public ValueTask RunAsync(CancellationToken cancellationToken) => ...;
[Every("1m")] public void Run() => ...;
```

A method with another parameter, or a class without a single job method, is refused with an
`ArgumentException` when the jobs are added, not when they run. An override's own attributes replace
those of the method it overrides.

## Several objects of one class

`RegisterOptions` lets one class run once per tenant, region or store: a `Prefix` for the names, a
`TimeZone` for its cron jobs, and `Defaults` for every job of the object, run data included.

```csharp
foreach (var region in regions)
{
    scheduler.Register(new RegionalExport(), new RegisterOptions
    {
        Prefix = $"{region.Name}.",                                    // "eu.export", "us.export"
        TimeZone = TimeZoneInfo.FindSystemTimeZoneById(region.TimeZone),
        Defaults = new() { Data = region, HistorySize = 100 },
    });
}

public sealed class RegionalExport
{
    [Every("4s", Name = "export", Timeout = "3s")]
    public Task ExportAsync(JobContext ctx) => ExportForAsync(ctx.GetData<Region>(), ctx.CancellationToken);
}
```

`AddJobs<T>(new RegisterOptions { ... })` takes the same options.

## One-off jobs take an absolute time

`[At]` takes a fixed time. A time computed when the program starts ("in one hour") belongs in code:
`scheduler.At("reminder", DateTimeOffset.UtcNow.AddHours(1), RemindAsync)`. A one-off job whose time
passed long ago never runs again; within the catch-up window it is caught up once, as other jobs are.

## Examples to run

```sh
dotnet run --project examples/Attributes   # Register() with a prefix, a time zone and defaults
dotnet run --project examples/Hosting      # AddJobs<T>() in a worker service, with dependency injection
```

Both are in [anarchon-dotnet](https://github.com/aristoteliss/anarchon-dotnet/tree/main/examples).

## Next

- [Job options](../job-options/): what each option does
- [Attributes reference](../../reference/dotnet/attributes/): every attribute and property
- [ASP.NET Core](../../recipes/aspnet-core/): jobs in a web app
