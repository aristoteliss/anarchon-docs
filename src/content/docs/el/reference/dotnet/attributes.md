---
title: Attributes (.NET)
description: "Τα [Every], [Cron] και [At], οι ιδιότητές τους, το RegisterOptions και το Duration."
---

Τα attributes δηλώνουν εργασίες πάνω σε μεθόδους. Ο οδηγός [Attributes](../../../guides/attributes/) εξηγεί τη χρήση τους· αυτή
η σελίδα παραθέτει κάθε μέλος. Όλα βρίσκονται στο namespace `Anarchon`.

## Τα attributes

| Attribute | Constructor | Δικές του ιδιότητες |
| --- | --- | --- |
| `EveryAttribute` | `[Every(string interval)]`, όπως `"10s"` | `Overlap`, `Offset` |
| `CronAttribute` | `[Cron(string expression)]`, 5 ή 6 πεδία | `Overlap`, `TimeZone` (ένα IANA ή Windows ID) |
| `AtAttribute` | `[At(string when)]`, ISO 8601, UTC εκτός αν δηλώνεται διαφορετικά | καμία |

Κάθε attribute διαθέτει επίσης τις ιδιότητες του `JobAttribute`:

| Ιδιότητα | Τύπος | Αντίστοιχη επιλογή εργασίας |
| --- | --- | --- |
| `Name` | `string?` | Το όνομα της εργασίας. Προεπιλογή `Type-Method`, όπως `ReportJobs-SyncAsync` |
| `Jitter` | `string?` | `Jitter`. Το `"0s"` το απενεργοποιεί |
| `MaxLate` | `string?` | `MaxLate` |
| `Timeout` | `string?` | `Timeout` |
| `HistorySize` | `int` | `HistorySize` |
| `HistoryTtl` | `string?` | `HistoryTtl` |
| `MaxAttempts` | `int` | `MaxAttempts` (lease backends) |
| `CatchUp` | `string?` | `CatchUp` (lease backends). Το `"0s"` το απενεργοποιεί |
| `YieldAfterFailure` | `bool` | `YieldAfterFailure` (lease backends) |

Το `Overlap` είναι ένα `OverlapPolicy`: `Skip` (προεπιλογή) ή `Allow`. Οι τιμές κειμένου διαβάζονται από το
`Duration.Parse`· μια μη έγκυρη τιμή εγείρει `ArgumentException` αναφέροντας το όνομα της μεθόδου κατά την προσθήκη των
εργασιών. Δείτε [Επιλογές εργασιών](../../../guides/job-options/) για το τι κάνει κάθε επιλογή.

## Οι μέθοδοι

Μια μέθοδος εργασίας είναι μια public μέθοδος instance, συμπεριλαμβανομένων των κληρονομημένων, με ένα attribute. Επιστρέφει
`Task`, `ValueTask` ή `void`, και δέχεται οποιοδήποτε εκ των `JobContext` και `CancellationToken`, με οποιαδήποτε σειρά.
Οτιδήποτε άλλο εγείρει `ArgumentException` κατά την προσθήκη των εργασιών. Τα attributes μιας μεθόδου override
αντικαθιστούν εκείνα της μεθόδου που παρακάμπτει.

## Προσθήκη των εργασιών

| Κλήση | Αντικείμενο ανά εκτέλεση |
| --- | --- |
| `scheduler.Register(object target, RegisterOptions? options = null)` | Το συγκεκριμένο αντικείμενο που δόθηκε |
| `builder.AddJobs<T>(RegisterOptions? options = null)` | Ένα νέο `T` από ένα νέο service scope. Το `T` καταχωρίζεται ως scoped εκτός αν είναι ήδη |

## RegisterOptions

| Ιδιότητα | Τύπος | Αποτέλεσμα |
| --- | --- | --- |
| `Prefix` | `string?` | Τοποθετείται πριν από κάθε όνομα εργασίας: το `"eu."` δημιουργεί το `"eu.export"` |
| `TimeZone` | `TimeZoneInfo?` | Η ζώνη ώρας των εργασιών cron του αντικειμένου που δεν ορίζουν δική τους |
| `Defaults` | `JobOptions?` | Επιλογές για κάθε εργασία του αντικειμένου, συμπεριλαμβανομένου του `Data`. Μια ιδιότητα του attribute τις υπερισχύει |

Η σειρά προτεραιότητας για κάθε επιλογή: το attribute, έπειτα το `RegisterOptions.Defaults`, και τέλος ο scheduler.

## Duration

| Μέλος | Λειτουργία |
| --- | --- |
| `Duration.Parse(string value)` → `TimeSpan` | Διαβάζει `"500ms"`, `"10s"`, `"35m"`, `"1h30m"`, `"2d"`, `"1.5h"`, ή milliseconds ως ψηφία. Αν δεν είναι θετική τιμή ή έγκυρη διάρκεια: `ArgumentException` |
| `Duration.Format(TimeSpan value)` → `string` | Γράφει μια διάρκεια με τη μορφή που διαβάζει η `Parse`: `"1h30m"` |

Η `Duration.Parse` είναι επίσης χρήσιμη για διάρκειες σε αρχεία παραμετροποίησης:
`Duration.Parse(configuration["Jobs:ExportTimeout"] ?? "5m")`.
