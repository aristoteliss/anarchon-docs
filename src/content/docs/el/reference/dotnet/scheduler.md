---
title: Scheduler (.NET)
description: Κάθε μέθοδος, ιδιότητα και συμβάν της κλάσης .NET Scheduler.
---

`Anarchon.Scheduler`, από το πακέτο `Anarchon`. Η αντίστοιχη κλάση του Node.js περιγράφεται στη σελίδα
[Scheduler](../../scheduler/).

```csharp
await using var scheduler = new Scheduler(new SchedulerOptions { Backend = new RedisBackend("localhost:6379") });
scheduler.Every("sync", TimeSpan.FromSeconds(10), ctx => SyncAsync(ctx.CancellationToken));
await scheduler.StartAsync();
```

## Constructor

| Υπογραφή | Σημειώσεις |
| --- | --- |
| `Scheduler(SchedulerOptions options)` | Ελέγχει τις επιλογές και δεν ανοίγει συνδέσεις. Το `Backend` απαιτείται. Δείτε [Επιλογές](../options/) |

Εγείρει `ArgumentException` ή `ArgumentOutOfRangeException` για μη έγκυρη τιμή, και
`AnarchonException` (`Unsupported`) για τα `Lease` ή `Heartbeat` σε backend χωρίς μισθώσεις (leases).

## Προσθήκη και αφαίρεση εργασιών

Κάθε μέθοδος επιστρέφει τον scheduler, επιτρέποντας αλυσιδωτές κλήσεις (chaining). Οι εργασίες μπορούν να προστεθούν πριν ή μετά τη `StartAsync()`.

| Μέθοδος | Προσθέτει |
| --- | --- |
| `Every(string name, TimeSpan interval, Func<JobContext, Task> handler, EveryJobOptions? options = null)` | Μια εργασία σε σταθερό πλέγμα από το Unix epoch, σε UTC |
| `Cron(string name, string expression, Func<JobContext, Task> handler, CronJobOptions? options = null)` | Μια εργασία cron: 5 πεδία, ή 6 με πρώτα τα δευτερόλεπτα. Αναλύεται από το Cronos |
| `At(string name, DateTimeOffset when, Func<JobContext, Task> handler, JobOptions? options = null)` | Μια εφάπαξ εργασία |
| `Register(object target, RegisterOptions? options = null)` | Κάθε εργασία που δηλώνεται με [attributes](../attributes/) στις μεθόδους του αντικειμένου, ή καμία |
| `Remove(string name)` → `bool` | Αφαιρεί μια εργασία τοπικά. Μια εκτέλεση που βρίσκεται ήδη σε εξέλιξη εδώ ολοκληρώνεται. Επιστρέφει `false` όταν καμία εργασία δεν έχει αυτό το όνομα |

Ένα όνομα που είναι ήδη καταχωρημένο εγείρει `AnarchonException` (`JobExists`), και ένα κενό όνομα
`ArgumentException`. Τα RabbitMQ και NATS δέχονται μόνο γράμματα, ψηφία, `_` και `-` (`Unsupported`).

## Εκκίνηση και τερματισμός

| Μέθοδος | Λειτουργία |
| --- | --- |
| `StartAsync(CancellationToken = default)` → `Task` | Συνδέεται, προετοιμάζει κάθε εργασία, ανακτά (recovers) και καλύπτει καθυστερούμενες (catches up) εκτελέσεις, και οπλίζει τα χρονόμετρα. Εάν αποτύχει, το backend κλείνει και η `StartAsync()` μπορεί να κληθεί ξανά |
| `StopAsync(CancellationToken = default)` → `Task` | Σταματά τα χρονόμετρα, ακυρώνει τα tokens των τρεχουσών εργασιών, περιμένει έως το `StopTimeout` (ή μέχρι να ακυρωθεί το token), και έπειτα κλείνει ό,τι άνοιξε το backend. Ασφαλές για διπλή κλήση |
| `DisposeAsync()`, `Dispose()` | Το ίδιο με τη `StopAsync()` |

Με έναν host, η `AddAnarchon()` καλεί και τις δύο μεθόδους αυτόματα για εσάς. Δείτε [Hosting](../hosting/).

## Εκτέλεση και ανάγνωση

| Μέλος | Επιστρέφει |
| --- | --- |
| `RunNowAsync(string name, object? data = null)` | `Task<RunRecord>`: εκτελεί την εργασία εδώ, άμεσα, μόλις ολοκληρωθεί. Μια χειροκίνητη εκτέλεση δεν λαμβάνει μέρος στο κανονικό πρόγραμμα. Το `data` αντικαθιστά τα [δεδομένα εκτέλεσης (run data)](../../../guides/run-data/) της εργασίας για αυτή την εκτέλεση. Απαιτείται προηγουμένως `StartAsync()` (`State`) |
| `HistoryAsync(string name, int limit = 20, CancellationToken = default)` | `Task<IReadOnlyList<RunRecord>>`: εκτελέσεις από κάθε instance, οι πιο πρόσφατες πρώτα, μία εγγραφή ανά προσπάθεια. Λειτουργεί για οποιοδήποτε όνομα εργασίας, χωρίς ανάγκη για `StartAsync()` |
| `LastRunAsync(string name, CancellationToken = default)` | `Task<RunRecord?>`: η πιο πρόσφατη εγγραφή, ή `null` |
| `GetNextRun(string name)` | `DateTimeOffset?`: ο επόμενος προγραμματισμένος χρόνος, ή `null` όταν δεν υπάρχει, όπως σε μια εφάπαξ εργασία της οποίας ο χρόνος έχει παρέλθει. Άγνωστο όνομα: `UnknownJob` |
| `GetJobs()` | `IReadOnlyList<JobInfo>`: οι εργασίες που είναι καταχωρημένες εδώ |
| `SetData(object? data)` | Τον scheduler. Αντικαθιστά τα run data σε επίπεδο scheduler |
| `Backend` | `IBackend`: το `Backend.Name` είναι `"redis:lease"`, `"postgres"`, `"sqlite"`, `"rabbitmq"`, `"nats"` ή `"nats:lease"` |
| `InstanceId` | `string`: το αναγνωριστικό αυτού του instance |

Το `JobInfo` διαθέτει τα `Name`, `Type` (`JobType.Every`, `Cron`, `Once`), `Schedule` (κείμενο), `NextRunAt` και
`RunningHere` (πόσες εκτελέσεις της εργασίας εκτελούνται αυτή τη στιγμή εδώ).

## Συμβάντα

Τυπικά .NET events. Ένας handler που εγείρει εξαίρεση καταγράφεται στο log και δεν επηρεάζει ποτέ την εκτέλεση. Δείτε
[Συμβάντα](../events/).

| Συμβάν | Ορίσματα |
| --- | --- |
| `Started` | `RunStartEvent` |
| `Succeeded` | `RunRecord` |
| `Failed` | `RunFailureEvent` |
| `Interrupted` | `RunInterruptedEvent` |
| `Skipped` | `SkipEvent` |
| `Lost` | `LostEvent` |
| `Error` | `SchedulerErrorEvent` |

## JobContext

Ό,τι λαμβάνει ένας handler.

| Ιδιότητα | Τύπος | Σημασία |
| --- | --- | --- |
| `Name` | `string` | Το όνομα της εργασίας |
| `Slot` | `long` | Ο προγραμματισμένος χρόνος σε Unix ms: μαζί με το όνομα, η ταυτότητα της εκτέλεσης. Ίδιο σε κάθε προσπάθεια |
| `ScheduledAt` | `DateTimeOffset` | Ο προγραμματισμένος χρόνος, όχι ο χρόνος έναρξης του handler |
| `InstanceId` | `string` | Αυτό το instance |
| `Attempt` | `int` | 1, ή περισσότερο μετά από ανάληψη (takeover) |
| `Reason` | `RunReason` | `Scheduled`, `Manual`, `CatchUp` ή `Takeover` |
| `IsManual` | `bool` | Ξεκίνησε από τη `RunNowAsync()` |
| `CancellationToken` | `CancellationToken` | Ακυρώνεται σε περίπτωση timeout, κατά τη `StopAsync()`, και όταν χαθεί η μίσθωση |
| `Data` | `object?` | Τα δεδομένα εκτέλεσης (run data) |
| `GetData<T>()` | `T` | Τα δεδομένα εκτέλεσης ως `T`· διαφορετικός τύπος αποτυγχάνει την εκτέλεση αναφέροντας και τους δύο τύπους |

## RunRecord

Μία προσπάθεια μιας εκτέλεσης, από τις `HistoryAsync()`, `LastRunAsync()`, `RunNowAsync()` και το συμβάν `Succeeded`.

| Ιδιότητα | Τύπος |
| --- | --- |
| `Job`, `Slot`, `ScheduledAt`, `InstanceId` | όπως στο context |
| `Attempt`, `Reason`, `IsManual` | όπως στο context |
| `Status` | `RunStatus`: `Running`, `Success`, `Failed`, `Interrupted` |
| `StartedAt`, `FinishedAt` | `DateTimeOffset`, `DateTimeOffset?` |
| `Duration` | `TimeSpan?` |
| `Error` | `string?`: `"Type: message"` μιας αποτυχημένης εκτέλεσης |
