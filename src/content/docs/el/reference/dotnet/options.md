---
title: Επιλογές (.NET)
description: Κάθε ιδιότητα του SchedulerOptions και των κλάσεων επιλογών εργασιών, μαζί με τις προεπιλογές.
---

Οι επιλογές του scheduler του .NET και των εργασιών του. Οι οδηγοί [Επιλογές scheduler](../../../guides/scheduler-options/)
και [Επιλογές εργασιών](../../../guides/job-options/) εξηγούν καθεμία αναλυτικά· οι επιλογές των διαφόρων backends βρίσκονται
στη σελίδα κάθε [backend](../../../backends/overview/).

## SchedulerOptions

| Ιδιότητα | Τύπος | Προεπιλογή | Σημειώσεις |
| --- | --- | --- | --- |
| `Backend` | `IBackend?` | απαιτείται | Το store |
| `InstanceId` | `string?` | `machine:pid` | Ένα όνομα pod ή host διαβάζεται καλύτερα |
| `Data` | `object?` | κανένα | Δεδομένα εκτέλεσης για κάθε εργασία· ένας `JobDataProvider` καλείται σε κάθε εκτέλεση |
| `Jitter` | `TimeSpan` | 2 s | Περιορίζεται στο ένα τέταρτο του μεσοδιαστήματος της εργασίας, εκτός αν η εργασία ορίζει δικό της |
| `MaxLate` | `TimeSpan` | 60 s | Πρέπει να είναι μεγαλύτερο από το jitter |
| `HistorySize` | `int` | 1000 | Εκτελέσεις που διατηρούνται ανά εργασία, κατά προσέγγιση |
| `HistoryTtl` | `TimeSpan?` | κανένα | Διαγραφή και παλαιότερων εγγραφών. Όχι σε RabbitMQ ή NATS |
| `TimeZone` | `TimeZoneInfo?` | η τοπική ζώνη του server | Για εργασίες cron. Ορίστε το |
| `Lease` | `TimeSpan?` | 30 s | Μόνο σε lease backends |
| `Heartbeat` | `TimeSpan?` | 5 s, ή το ένα έκτο του `Lease` αν είναι μικρότερο | Κάτω από το μισό του `Lease`. Μόνο σε lease backends |
| `StopTimeout` | `TimeSpan` | 30 s | Πόσο χρόνο περιμένει η `StopAsync()` για τις τρέχουσες εργασίες |
| `LoggerFactory` | `ILoggerFactory?` | κανένα· του host με την `AddAnarchon()` | Κατηγορία `Anarchon.Scheduler` |
| `TimeProvider` | `TimeProvider?` | `TimeProvider.System`· του container με την `AddAnarchon()` | Το ρολόι και τα χρονόμετρα του scheduler |

## Επιλογές εργασιών (Job options)

Οι κλάσεις είναι ιεραρχικά φωλιασμένες: η `JobOptions` για το `At()`, η `RecurringJobOptions` προσθέτει το `Overlap`,
και οι `EveryJobOptions` και `CronJobOptions` προσθέτουν από μία ιδιότητα η καθεμία. Κάθε ιδιότητα είναι nullable: το `null`
λαμβάνει την τιμή του scheduler ή την προεπιλογή.

| Ιδιότητα | Κλάση | Τύπος | Προεπιλογή |
| --- | --- | --- | --- |
| `Jitter` | `JobOptions` | `TimeSpan?` | του scheduler, το πολύ το ένα τέταρτο του μεσοδιαστήματος. Κάτω από το μισό του |
| `MaxLate` | `JobOptions` | `TimeSpan?` | του scheduler |
| `Timeout` | `JobOptions` | `TimeSpan?` | χωρίς όριο |
| `HistorySize` | `JobOptions` | `int?` | του scheduler |
| `HistoryTtl` | `JobOptions` | `TimeSpan?` | του scheduler |
| `Data` | `JobOptions` | `object?` | του scheduler, συγχωνεύονται όταν και τα δύο είναι λεξικά (dictionaries) |
| `MaxAttempts` | `JobOptions` | `int?` | 3, από 1 έως 100. Μόνο σε lease backends |
| `CatchUp` | `JobOptions` | `TimeSpan?` | 5 λεπτά. Μόνο σε lease backends |
| `YieldAfterFailure` | `JobOptions` | `bool?` | `false`. Μόνο σε lease backends |
| `Overlap` | `RecurringJobOptions` | `OverlapPolicy?` | `Skip`. Μόνο σε lease backends |
| `Offset` | `EveryJobOptions` | `TimeSpan?` | μηδέν: μετατοπίζει το πλέγμα |
| `TimeZone` | `CronJobOptions` | `TimeZoneInfo?` | του scheduler |

Μια επιλογή που αφορά μόνο μισθώσεις σε ένα backend χωρίς μισθώσεις εγείρει `AnarchonException` (`Unsupported`) όταν προστίθεται
η εργασία, ώστε καμία ρύθμιση να μην αγνοείται σιωπηρά.

## Τα ονόματα του Node.js

| Node.js | .NET |
| --- | --- |
| `jitterMs`, `maxLateMs`, `timeoutMs` | `Jitter`, `MaxLate`, `Timeout` |
| `catchUpMs`, `historyTtlMs`, `offsetMs` | `CatchUp`, `HistoryTtl`, `Offset` |
| `leaseMs`, `heartbeatMs` | `Lease`, `Heartbeat` |
| `overlap: 'skip'` | `Overlap = OverlapPolicy.Skip` |
| `timezone: 'Europe/Athens'` | `TimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Athens")` |
| `stop({ timeoutMs })` | `StopTimeout` |
| `log: true` | `LoggerFactory` |
| `unrefTimers` | κανένα |
