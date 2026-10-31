---
title: Worker service
description: Ένα worker service στο .NET που εκτελεί προγραμματισμένες εργασίες, με εργασίες από dependency injection, παραμετροποίηση από το appsettings.json και καθαρό τερματισμό στο SIGTERM.
sidebar:
  badge: '.NET'
---

Ένα worker service είναι μια εφαρμογή .NET με host αλλά χωρίς web server: το φυσικό περιβάλλον για εργασίες που πρέπει να
εκτελούνται ξεχωριστά από τις διεργασίες που εξυπηρετούν αιτήματα (requests). Ο host ξεκινά τον scheduler και τον σταματά στο
`SIGTERM` ή με Ctrl+C.

## Δημιουργία

```sh
dotnet new worker -n Reports
cd Reports
dotnet add package Anarchon.Redis
```

Διαγράψτε το `Worker.cs` που δημιούργησε το πρότυπο· ο scheduler παίρνει τη θέση του.

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

## Οι εργασίες

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

Κάθε εκτέλεση λαμβάνει ένα νέο service scope και ένα νέο `ReportJobs` από αυτό, ώστε η κλάση να μπορεί να δέχεται scoped
services. Ο οδηγός [Attributes](../../guides/attributes/) παραθέτει κάθε ιδιότητα.

## Παραμετροποίηση

Το connection string προέρχεται από τις ρυθμίσεις παραμετροποίησης (configuration), οπότε δεν βρίσκεται ποτέ μέσα στον κώδικα:

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

Στην παραγωγή, ορίστε το από το περιβάλλον (`ConnectionStrings__redis`) ή από ένα secret store. Στο επίπεδο
`Debug` ο scheduler καταγράφει κάθε εκτέλεση που ξεκινά και ολοκληρώνει· στο `Information` καταγράφει μόνο
ό,τι πάει στραβά.

## Εκτέλεση πολλαπλών αντιγράφων

Ξεκινήστε το worker σε τρία τερματικά. Κάθε προγραμματισμένος χρόνος εκτελείται σε ένα από αυτά· σταματήστε το ένα με Ctrl+C
και τα υπόλοιπα συνεχίζουν κανονικά. Σε ένα backend με μίσθωση (lease backend), μια εργασία που εκτελούνταν παραδίδεται μέσα σε δύο
heartbeats.

```sh
dotnet run
```

## Τερματισμός

Ο host διακόπτει τον scheduler όταν λάβει `SIGTERM` (Docker, Kubernetes, systemd) ή Ctrl+C:

1. Οι εκτελούμενες εργασίες βλέπουν το `ctx.CancellationToken` να ακυρώνεται.
2. Μια εργασία που εγείρει σφάλμα εκείνη τη στιγμή παραδίδεται αμέσως σε άλλο instance.
3. Ο host περιμένει έως το `StopTimeout` (30 δευτερόλεπτα), και όχι περισσότερο από το δικό του `ShutdownTimeout`.

Οι εργασίες που μεταβιβάζουν το token σε κάθε κλήση που κάνουν σταματούν εγκαίρως. Δείτε
[Συγγραφή handlers](../../guides/writing-handlers/) και [Εργασίες μεγάλης διάρκειας](../long-running-jobs/).

## Σε container

```dockerfile
FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app
COPY bin/Release/net10.0/publish/ .
ENTRYPOINT ["dotnet", "Reports.dll"]
```

Το `ENTRYPOINT` σε αυτή τη μορφή καθιστά το `dotnet` τη διεργασία που λαμβάνει το `SIGTERM`. Δώστε σε κάθε container
το όνομά του ως `InstanceId`, ώστε το ιστορικό να δείχνει ποιο εκτέλεσε κάθε run:

```csharp
builder.Services.AddAnarchon(options => options.InstanceId = Environment.GetEnvironmentVariable("POD_NAME"));
```

## Ως υπηρεσία systemd

```sh
dotnet add package Microsoft.Extensions.Hosting.Systemd
```

```csharp
builder.Services.AddSystemd();
```

Το `systemctl stop` στέλνει τότε `SIGTERM` και περιμένει τον host. Διατηρήστε το `TimeoutStopSec` μεγαλύτερο από
το `StopTimeout`.

## Εκτέλεση του παραδείγματος

Το [παράδειγμα `Hosting`](https://github.com/aristoteliss/anarchon-dotnet/tree/main/examples/Hosting) είναι
αυτό το worker:

```sh
dotnet run --project examples/Hosting
```

## Επόμενα βήματα

- [ASP.NET Core](../aspnet-core/): εργασίες σε web εφαρμογή, με endpoints
- [Rolling deploys στο Kubernetes](../kubernetes/)
- [Αναφορά hosting](../../reference/dotnet/hosting/)
