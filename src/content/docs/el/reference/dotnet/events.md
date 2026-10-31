---
title: Συμβάντα (.NET)
description: Κάθε συμβάν του .NET Scheduler, τα ορίσματά του, και τα μηνύματα καταγραφής (log messages).
---

Τα συμβάντα είναι τυπικά .NET events στον `Scheduler`. Ο οδηγός [Συμβάντα και καταγραφή](../../../guides/events-and-logging/)
δείχνει πώς να τα χρησιμοποιείτε· τα συμβάντα του Node.js βρίσκονται στη σελίδα [Συμβάντα](../../events/).

```csharp
scheduler.Failed += (_, e) => logger.LogError(e.Cause, "{Job} failed on attempt {Attempt}", e.Job, e.Attempt);
```

Διατηρείτε τους handlers σύντομους: εκτελούνται εντός των λειτουργιών του scheduler για την εκτέλεση. Εάν κάποιος εγείρει
εξαίρεση, αυτή καταγράφεται στο log και η εκτέλεση δεν επηρεάζεται.

## Τα συμβάντα

| Συμβάν | Πότε εγείρεται | Ορίσματα |
| --- | --- | --- |
| `Started` | Αυτό το instance ξεκινά μια εκτέλεση | `RunStartEvent` |
| `Succeeded` | Μια εκτέλεση εδώ ολοκληρώθηκε επιτυχώς | `RunRecord` |
| `Failed` | Μια εκτέλεση εδώ έριξε εξαίρεση ή εξάντλησε το χρονικό όριο (timeout) | `RunFailureEvent` |
| `Interrupted` | Μια εκτέλεση εδώ τερματίστηκε μετά από `StopAsync()` ή μια χαμένη μίσθωση ακύρωσε το token της | `RunInterruptedEvent` |
| `Skipped` | Αυτό το instance δεν εκτέλεσε μια προγραμματισμένη εκτέλεση | `SkipEvent` |
| `Lost` | Μια εκτέλεση εδώ δεν μπόρεσε να ανανεώσει τη μίσθωσή της, και ένα εφεδρικό instance μπορεί να την αναλάβει | `LostEvent` |
| `Error` | Κάτι απέτυχε εκτός ενός handler, όπως μια διεκδίκηση (claim) που αρνήθηκε το store | `SchedulerErrorEvent` |

## Τα ορίσματα

Κάθε συμβάν εκτέλεσης διαθέτει τα `Job`, `Slot`, `ScheduledAt` και `InstanceId` (από το `RunEvent`).

| Τύπος | Προσθέτει |
| --- | --- |
| `RunStartEvent` | `Attempt`, `Reason` (`RunReason`), `IsManual` |
| `RunRecord` | `Attempt`, `Reason`, `IsManual`, `Status`, `StartedAt`, `FinishedAt`, `Duration`, `Error` |
| `RunFailureEvent` | Τα πεδία του `RunRecord`, και `Cause`: την εξαίρεση |
| `RunInterruptedEvent` | Τα πεδία του `RunRecord`, `Cause`, και `HandedOver`: εάν η εκτέλεση παραδόθηκε κατά τη διακοπή, ώστε ένας εφεδρικός να την αναλάβει αμέσως |
| `SkipEvent` | `Reason` (`SkipReason.Taken`, `Late` ή `Overlap`), `Late`: πόσο καθυστέρησε αυτό το instance |
| `LostEvent` | `Attempt` |
| `SchedulerErrorEvent` | `Job` και `Slot` (όταν το σφάλμα αφορά μια εκτέλεση), `Error`: την εξαίρεση |

Το `SkipReason.Taken` είναι η φυσιολογική περίπτωση σε κάθε instance εκτός από τον νικητή. Μετρήστε το στις μετρικές, αλλά
μην ορίζετε ειδοποιήσεις (alerts) για αυτό.

## Μηνύματα καταγραφής (Log messages)

Με ένα `LoggerFactory` (το οποίο ρυθμίζει αυτόματα ένας host), ο scheduler καταγράφει στην κατηγορία
`Anarchon.Scheduler`:

| Αναγνωριστικό συμβάντος (Event ID) | Επίπεδο (Level) | Μήνυμα |
| --- | --- | --- |
| 1 | Debug | `{Job} @ {Due}: started on {Instance} (attempt {Attempt}, {Reason})` |
| 2 | Debug | `{Job} @ {Due}: finished in {DurationMs} ms` |
| 3 | Warning | `{Job} @ {Due}: failed after {DurationMs} ms: {Error}` |
| 4 | Debug | `{Job} @ {Due}: interrupted after {DurationMs} ms (handed over: {HandedOver})` |
| 5 | Debug | `{Job} @ {Due}: skipped ({Reason})` |
| 6 | Warning | `{Job} @ {Due}: attempt {Attempt} was taken over by a backup` |
| 7 | Error | `Error in {Subject}: {Message}`, όταν δεν έχει συνδεθεί handler στο `Error` |
| 8 | Error | `A {Event} handler threw` |
| 9 | Warning | `Closing {Backend} failed` |

Τα μηνύματα είναι δομημένα (structured): τα `Job`, `Due`, `Instance` και τα υπόλοιπα είναι ιδιότητες στις οποίες ένα σύστημα
συλλογής logs μπορεί να εφαρμόσει φίλτρα.
