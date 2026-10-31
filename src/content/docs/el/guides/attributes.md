---
title: Attributes (.NET)
description: Δηλώστε εργασίες στις μεθόδους μιας κλάσης με τα [Cron], [Every] και [At], προσθέστε τις με τη Register() ή, σε έναν host, με την AddJobs<T>(), η οποία εκτελεί κάθε εργασία σε δικό της service scope.
---

Στο .NET, οι εργασίες μπορούν να δηλωθούν στις μεθόδους μιας κλάσης με τα `[Cron]`, `[Every]` και `[At]`, αντί
να μεταβιβάζονται στα `Cron()`, `Every()` και `At()`. Στο Node.js η αντίστοιχη προσέγγιση είναι οι
[decorators](../decorators/), με διαφορετικό τρόπο προσθήκης των εργασιών.

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

## Προσθήκη των εργασιών

Υπάρχουν δύο τρόποι, και οι δύο προσθέτουν είτε όλες τις εργασίες της κλάσης είτε καμία.

**Με έναν host** (ASP.NET Core, ένα worker service), το `AddJobs<T>()` καταχωρίζει την κλάση ως scoped
service. Κάθε εκτέλεση λαμβάνει ένα νέο service scope και ένα νέο αντικείμενο από αυτό, ώστε η κλάση να μπορεί να δέχεται scoped
services, όπως ένα `DbContext`:

```csharp
builder.Services
    .AddAnarchon(options => options.TimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Athens"))
    .UseRedis(builder.Configuration.GetConnectionString("redis")!)
    .AddJobs<ReportJobs>();
```

Ο host ξεκινά τον scheduler και τον διακόπτει κατά τον τερματισμό. Δείτε [ASP.NET Core](../../recipes/aspnet-core/)
και [Worker service](../../recipes/worker-service/).

**Χωρίς host**, το `Register(object)` προσθέτει τις εργασίες ενός μεμονωμένου αντικειμένου, το οποίο εκτελεί κάθε εργασία:

```csharp
await using var scheduler = new Scheduler(new SchedulerOptions { Backend = backend });
scheduler.Register(new ReportJobs(db, mailer));
await scheduler.StartAsync();
```

## Τα τρία attributes

| Attribute | Το πρόγραμμα | Αντίστοιχο με |
| --- | --- | --- |
| `[Every("10s")]` | Ένα μεσοδιάστημα στο πλέγμα UTC, ως κείμενο: `"10s"`, `"35m"`, `"1h30m"`, `"2d"` | `Every()` |
| `[Cron("0 8 * * 1-5")]` | Μια έκφραση cron, 5 πεδίων ή 6 με πρώτα τα δευτερόλεπτα | `Cron()` |
| `[At("2026-12-01T09:00:00Z")]` | Μία συγκεκριμένη ώρα, ως κείμενο ISO 8601 (UTC εκτός αν δηλώνεται διαφορετικά) | `At()` |

Κάθε επιλογή μιας εργασίας είναι ιδιότητα του attribute. Οι διάρκειες είναι κείμενο, που διαβάζονται από το `Duration.Parse`
(`"30s"`, `"1h30m"`, `"500ms"`):

| Ιδιότητα | Σε | Σημασία |
| --- | --- | --- |
| `Name` | όλα | Το όνομα της εργασίας. Προεπιλογή `Type-Method`, όπως `ReportJobs-SyncAsync` |
| `Jitter`, `MaxLate`, `Timeout`, `HistoryTtl`, `CatchUp` | όλα | Όπως στις [επιλογές εργασιών](../job-options/). Το `Jitter = "0s"` και το `CatchUp = "0s"` τα απενεργοποιούν |
| `HistorySize`, `MaxAttempts`, `YieldAfterFailure` | όλα | Όπως στις επιλογές εργασιών |
| `Overlap` | `[Every]`, `[Cron]` | `OverlapPolicy.Skip` (προεπιλογή) ή `OverlapPolicy.Allow` |
| `TimeZone` | `[Cron]` | Ένα όνομα IANA όπως `"Europe/Athens"` |
| `Offset` | `[Every]` | Μετατοπίζει το πλέγμα, όπως `"30m"` |

Μια ιδιότητα που παραλείπεται λαμβάνει την τιμή του `RegisterOptions.Defaults`, και στη συνέχεια του scheduler.

## Οι μέθοδοι

Μια μέθοδος εργασίας είναι μια public μέθοδος instance της κλάσης, συμπεριλαμβανομένων των κληρονομημένων. Επιστρέφει `Task`,
`ValueTask` ή τίποτα (`void`), και δέχεται οποιοδήποτε εκ των `JobContext` και `CancellationToken`, με οποιαδήποτε σειρά:

```csharp
[Every("1m")] public Task RunAsync(JobContext ctx) => ...;
[Every("1m")] public ValueTask RunAsync(CancellationToken cancellationToken) => ...;
[Every("1m")] public void Run() => ...;
```

Μια μέθοδος με άλλη παράμετρο, ή μια κλάση χωρίς καμία μέθοδο εργασίας, απορρίπτεται με ένα
`ArgumentException` κατά την προσθήκη των εργασιών, όχι κατά την εκτέλεσή τους. Τα attributes μιας μεθόδου override αντικαθιστούν
εκείνα της μεθόδου που παρακάμπτει.

## Πολλαπλά αντικείμενα μίας κλάσης

Το `RegisterOptions` επιτρέπει σε μία κλάση να εκτελείται μία φορά ανά tenant, περιοχή ή store: ένα `Prefix` για τα ονόματα, ένα
`TimeZone` για τις εργασίες cron της, και `Defaults` για κάθε εργασία του αντικειμένου, συμπεριλαμβανομένων των run data.

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

Το `AddJobs<T>(new RegisterOptions { ... })` δέχεται τις ίδιες επιλογές.

## Οι εφάπαξ εργασίες δέχονται απόλυτο χρόνο

Το `[At]` δέχεται έναν σταθερό χρόνο. Ένας χρόνος που υπολογίζεται κατά την εκκίνηση του προγράμματος («σε μία ώρα») ανήκει στον κώδικα:
`scheduler.At("reminder", DateTimeOffset.UtcNow.AddHours(1), RemindAsync)`. Μια εφάπαξ εργασία της οποίας ο χρόνος έχει
παρέλθει προ πολλού δεν εκτελείται ποτέ ξανά· εντός του παραθύρου ανάκτησης (catch-up window) ανακτάται μία φορά, όπως και οι υπόλοιπες εργασίες.

## Παραδείγματα προς εκτέλεση

```sh
dotnet run --project examples/Attributes   # Register() με prefix, ζώνη ώρας και προεπιλογές
dotnet run --project examples/Hosting      # AddJobs<T>() σε worker service, με dependency injection
```

Και τα δύο βρίσκονται στο [anarchon-dotnet](https://github.com/aristoteliss/anarchon-dotnet/tree/main/examples).

## Επόμενα βήματα

- [Επιλογές εργασιών](../job-options/): τι κάνει κάθε επιλογή
- [Αναφορά attributes](../../reference/dotnet/attributes/): κάθε attribute και ιδιότητα
- [ASP.NET Core](../../recipes/aspnet-core/): εργασίες σε web εφαρμογή
