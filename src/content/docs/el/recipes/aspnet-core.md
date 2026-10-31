---
title: ASP.NET Core
description: Ένας scheduler σε μια εφαρμογή ASP.NET Core, που ξεκινά και σταματά μαζί της, με εργασίες από dependency injection και endpoints για προβολή εργασιών, ανάγνωση ιστορικού και άμεση εκτέλεση.
sidebar:
  badge: '.NET'
---

Σε μια εφαρμογή ASP.NET Core ο scheduler είναι μια υπηρεσία. Το `AddAnarchon()` τον καταχωρίζει, ο host τον ξεκινά
μαζί με την εφαρμογή και τον διακόπτει κατά τον τερματισμό, και το `AddJobs<T>()` προσθέτει τις εργασίες που δηλώνονται σε μια κλάση με
[attributes](../../guides/attributes/). Κάθε εκτέλεση λαμβάνει ένα δικό της service scope, ώστε οι εργασίες να μπορούν να δέχονται
scoped services, όπως ένα `DbContext`.

Αυτό είναι το αντίστοιχο .NET των συνταγών [Express](../express/) και [NestJS](../nestjs/).

## Εγκατάσταση

```sh
dotnet add package Anarchon.Postgres   # ή Anarchon.Redis, Anarchon.Sqlite, Anarchon.RabbitMQ, Anarchon.Nats
```

Κάθε πακέτο backend φέρνει το `Anarchon` και τις μεθόδους `UsePostgres()`, `UseRedis()` (κ.ο.κ.).

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
        options.InstanceId = Environment.GetEnvironmentVariable("POD_NAME"); // ή αφήστε την προεπιλογή, host:pid
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
        return Results.Ok(await scheduler.RunNowAsync(name)); // απαντά μόλις ολοκληρωθεί η εκτέλεση
    }
    catch (AnarchonException error) when (error.Code == AnarchonErrorCode.UnknownJob)
    {
        return Results.NotFound(error.Message);
    }
}).RequireAuthorization("admin");

app.MapHealthChecks("/health");
app.Run();
```

Τι κάνει κάθε τμήμα:

| Κλήση | Αποτέλεσμα |
| --- | --- |
| `AddAnarchon(options => ...)` | Καταχωρίζει έναν `Scheduler` ως singleton, και ένα hosted service που τον ξεκινά και τον διακόπτει. Οι επιλογές είναι το [`SchedulerOptions`](../../reference/dotnet/options/) |
| `UsePostgres(...)` | Το backend. Η μορφή `(services, options)` λαμβάνει clients από το DI container· η μορφή string δέχεται connection string |
| `AddJobs<ReportJobs>()` | Καταχωρίζει το `ReportJobs` ως scoped, και προσθέτει κάθε εργασία που δηλώνουν τα attributes του |
| `Scheduler` σε έναν handler | Το ίδιο singleton: τα endpoints διαβάζουν ιστορικό και ξεκινούν εκτελέσεις μέσω αυτού |

Η καταγραφή (logging) του scheduler πηγαίνει στο logging της εφαρμογής, υπό την κατηγορία `Anarchon.Scheduler`. Δείτε
[Συμβάντα και καταγραφή](../../guides/events-and-logging/).

## Οι εργασίες

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

Ένα νέο `ReportJobs` δημιουργείται για κάθε εκτέλεση, από ένα νέο scope, και αποδεσμεύεται (disposed) μετά από αυτήν. Μην διατηρείτε state
στα πεδία του μεταξύ των εκτελέσεων· τα [δεδομένα εκτέλεσης (run data)](../../guides/run-data/) και το store είναι τα κατάλληλα σημεία για αυτό.

## Εκκίνηση και τερματισμός

- **Εκκίνηση.** Το hosted service καλεί το `StartAsync()` πριν η εφαρμογή δεχτεί αιτήματα. Εάν το store δεν είναι
  προσβάσιμο, η εκκίνηση αποτυγχάνει, και το ίδιο συμβαίνει με την εφαρμογή: ένα pod που δεν μπορεί να φτάσει το store του δεν είναι έτοιμο (ready).
- **Τερματισμός.** Στο `SIGTERM` ή με Ctrl+C ο host διακόπτει τον scheduler. Οι εκτελούμενες εργασίες βλέπουν το token τους να
  ακυρώνεται· σε ένα lease backend, μια εργασία που εγείρει σφάλμα εκείνη τη στιγμή παραδίδεται αμέσως σε άλλο instance. Η
  αναμονή είναι `StopTimeout` (30 δευτερόλεπτα), και όχι μεγαλύτερη από το `ShutdownTimeout` του host. Δείτε
  [Rolling deploys στο Kubernetes](../kubernetes/).

## Τα endpoints

| Endpoint | Καλεί | Σημειώσεις |
| --- | --- | --- |
| `GET /jobs` | `GetJobs()` | Εργασίες καταχωρημένες σε αυτό το instance, με την επόμενη εκτέλεσή τους |
| `GET /jobs/{name}/runs` | `HistoryAsync(name, limit)` | Εκτελέσεις από κάθε instance, οι πιο πρόσφατες πρώτα |
| `GET /jobs/{name}/last` | `LastRunAsync(name)` | Η πιο πρόσφατη εκτέλεση, ή 404 |
| `POST /jobs/{name}/run` | `RunNowAsync(name)` | Εκτελεί την εργασία τοπικά και απαντά όταν ολοκληρωθεί. Προστατεύστε το: το `"admin"` αντιπροσωπεύει μια δική σας πολιτική εξουσιοδότησης (authorization policy) |

Το `JsonStringEnumConverter` κάνει τις καταστάσεις και τους λόγους να διαβάζονται ως `"Success"` και `"Takeover"` αντί για
αριθμούς.

## Ο έλεγχος υγείας (health check)

Το `CronHealthCheck` ρωτά το store, όχι αυτό το instance, πότε εκτελέστηκε τελευταία φορά το `sync`. Επιτυγχάνει σε κάθε
instance εφόσον κάποιο instance εκτελεί την εργασία, κάτι που πρέπει να βλέπει ένας load balancer. Μην το
χρησιμοποιείτε για liveness: μια εργασία που αποτυγχάνει αποτελεί ειδοποίηση (alert), όχι λόγο επανεκκίνησης των pods.

```csharp
public sealed class CronHealthCheck(Scheduler scheduler) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var last = await scheduler.LastRunAsync("sync", cancellationToken);
        var age = last is null ? TimeSpan.MaxValue : DateTimeOffset.UtcNow - last.StartedAt;
        var ok = last?.Status != RunStatus.Failed && age < TimeSpan.FromSeconds(30); // το "sync" εκτελείται κάθε 10 s
        return ok ? HealthCheckResult.Healthy() : HealthCheckResult.Unhealthy($"last sync: {last?.Status}, {age} ago");
    }
}
```

## Εργασίες σε κώδικα αντί για attributes

Εργασίες μπορούν επίσης να προστεθούν μέσω κώδικα, μόλις γίνει build η εφαρμογή και πριν εκτελεστεί:

```csharp
var app = builder.Build();
app.Services.GetRequiredService<Scheduler>()
    .Every("sync", TimeSpan.FromSeconds(10), ctx => Task.Delay(100, ctx.CancellationToken))
    .Cron("digest", "0 8 * * 1-5", SendDigestAsync);
```

Τέτοιοι handlers εκτελούνται στο thread pool του scheduler, εκτός οποιουδήποτε scope: δημιουργήστε ένα scope μόνοι σας με το
`IServiceScopeFactory` όταν μια εργασία χρειάζεται scoped services.

## Πολλαπλοί schedulers

Το `AddAnarchon("name")` καταχωρίζει έναν keyed scheduler, για εργασίες σε άλλο store ή με διαφορετικούς χρόνους
μίσθωσης (lease timings). Ο καθένας έχει το δικό του backend και εργασίες, και ο host τους ξεκινά και τους σταματά όλους:

```csharp
builder.Services.AddAnarchon("billing").UseRedis(builder.Configuration.GetConnectionString("billing")!).AddJobs<BillingJobs>();

app.MapGet("/billing/jobs", ([FromKeyedServices("billing")] Scheduler billing) => billing.GetJobs());
```

## Εκτέλεση

Το [παράδειγμα `HttpApi`](https://github.com/aristoteliss/anarchon-dotnet/tree/main/examples/HttpApi)
είναι μια μικρότερη έκδοση αυτής της εφαρμογής, με ένα αρχείο SQLite από προεπιλογή:

```sh
dotnet run --project examples/HttpApi
curl localhost:3000/jobs
curl -X POST localhost:3000/jobs/sync/run
```

Ξεκινήστε το δύο φορές (`PORT=3001` για τη δεύτερη) και οι εκτελέσεις θα κατανεμηθούν και στα δύο instances.

## Επόμενα βήματα

- [Worker service](../worker-service/): το ίδιο χωρίς web server
- [Μια διεργασία worker και ένα read-only API](../worker-and-api/)
- [Αναφορά hosting](../../reference/dotnet/hosting/)
