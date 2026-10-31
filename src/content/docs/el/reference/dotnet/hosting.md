---
title: Hosting (.NET)
description: Το AddAnarchon(), οι μέθοδοι backend Use*, το AddJobs<T>(), και οι επώνυμοι schedulers.
---

Το hosting API καταχωρίζει έναν scheduler στο `IServiceCollection` και επιτρέπει στον host να τον ξεκινά και να τον διακόπτει.
Λειτουργεί σε οποιαδήποτε εφαρμογή βασίζεται στο `Microsoft.Extensions.Hosting`: ASP.NET Core, worker services, και
εφαρμογές κονσόλας με host. Δείτε τις συνταγές [ASP.NET Core](../../../recipes/aspnet-core/) και
[Worker service](../../../recipes/worker-service/).

```csharp
builder.Services
    .AddAnarchon(options => options.TimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Athens"))
    .UseRedis(builder.Configuration.GetConnectionString("redis")!)
    .AddJobs<ReportJobs>();
```

## AddAnarchon

Στο namespace `Microsoft.Extensions.DependencyInjection`.

| Υπερφόρτωση (Overload) | Καταχωρίζει |
| --- | --- |
| `AddAnarchon()` | Τον προεπιλεγμένο `Scheduler`, ως singleton |
| `AddAnarchon(Action<SchedulerOptions> configure)` | Το ίδιο, με επιλογές |
| `AddAnarchon(string name, Action<SchedulerOptions>? configure = null)` | Έναν επώνυμο scheduler, ως keyed singleton: `[FromKeyedServices("name")] Scheduler` |

Κάθε μέθοδος καταχωρίζει επίσης ένα hosted service που καλεί τη `StartAsync()` κατά την εκκίνηση του host και
τη `StopAsync()` κατά τον τερματισμό του. Οι επιλογές είναι named options (`IOptions<SchedulerOptions>`), οπότε η κλήση
`services.Configure<SchedulerOptions>(...)` προσθέτει σε αυτές. Η εκ νέου κλήση της `AddAnarchon()` με το
ίδιο όνομα απλώς προσθέτει επιλογές. Το `ILoggerFactory` και το `TimeProvider` του host χρησιμοποιούνται αυτόματα, εκτός αν
οριστούν διαφορετικά στις επιλογές.

## AnarchonBuilder

Ό,τι επιστρέφει η `AddAnarchon()`. Κάθε μέθοδος επιστρέφει τον builder.

| Μέλος | Λειτουργία |
| --- | --- |
| `UseBackend(Func<IServiceProvider, IBackend> factory)` | Ορίζει το backend, που δημιουργείται μία φορά από το container |
| `AddJobs<T>(RegisterOptions? options = null)` | Προσθέτει τις εργασίες που δηλώνει η `T` με [attributes](../attributes/). Η `T` καταχωρίζεται ως scoped εκτός αν είναι ήδη· κάθε εκτέλεση λαμβάνει ένα νέο scope και ένα νέο αντικείμενο `T` από αυτό |
| `Services` | Η συλλογή υπηρεσιών (service collection) |
| `Name` | Το όνομα του scheduler, κενό για τον προεπιλεγμένο |

## Οι μέθοδοι backend

Κάθε πακέτο backend προσθέτει τρεις υπερφορτώσεις στο `AnarchonBuilder`:

| Πακέτο | Μέθοδοι |
| --- | --- |
| `Anarchon.Redis` | `UseRedis(string configuration)`, `UseRedis(Action<RedisBackendOptions>)`, `UseRedis(Action<IServiceProvider, RedisBackendOptions>)` |
| `Anarchon.Postgres` | `UsePostgres(string connectionString)`, και τις δύο μορφές με επιλογές |
| `Anarchon.Sqlite` | `UseSqlite(string connectionString)`, και τις δύο μορφές με επιλογές |
| `Anarchon.RabbitMQ` | `UseRabbitMQ(string connectionString)`, και τις δύο μορφές με επιλογές |
| `Anarchon.Nats` | `UseNats(string connectionString)`, και τις δύο μορφές με επιλογές |

Η μορφή με `IServiceProvider` δέχεται clients που η εφαρμογή έχει ήδη καταχωρίσει, τους οποίους ο scheduler
δεν κλείνει ποτέ:

```csharp
builder.Services.AddNpgsqlDataSource(builder.Configuration.GetConnectionString("app")!);
builder.Services.AddAnarchon()
    .UsePostgres((services, options) => options.DataSource = services.GetRequiredService<NpgsqlDataSource>());
```

## Σφάλματα κατά την εκκίνηση

Ο scheduler και το backend του δημιουργούνται όταν επιλυθούν (resolved) για πρώτη φορά, κάτι που κάνει το hosted service
καθώς ξεκινά ο host. Μη έγκυρες επιλογές εγείρουν σφάλμα εκείνη τη στιγμή, και ένα store που δεν μπορεί να προσεγγιστεί κάνει
τη `StartAsync()`, και συνεπώς την εκκίνηση του host, να αποτύχει. Ένας host που ξεκινά επιτυχώς είναι ένας host του οποίου ο scheduler είναι συνδεδεμένος.

## Χωρίς host

Τίποτα από αυτά δεν είναι υποχρεωτικό: το `new Scheduler(options)` με τα `StartAsync()`, `StopAsync()` και
`Register()` λειτουργεί σε οποιοδήποτε πρόγραμμα. Δείτε [Κύκλος ζωής](../../../guides/lifecycle/).
