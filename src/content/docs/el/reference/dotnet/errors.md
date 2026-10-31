---
title: Σφάλματα (.NET)
description: Οι εξαιρέσεις (exceptions) που εγείρει ο scheduler του .NET, οι τιμές AnarchonErrorCode, και πώς να διορθώσετε την καθεμία.
---

Ο scheduler του .NET εγείρει τυπικές εξαιρέσεις (standard exceptions) για μη έγκυρα ορίσματα, και `AnarchonException` για τα
υπόλοιπα σφάλματα. Τα σφάλματα του Node.js βρίσκονται στη σελίδα [Σφάλματα](../../errors/).

## Μη έγκυρα ορίσματα (Bad arguments)

| Εξαίρεση | Πότε | Παράδειγμα |
| --- | --- | --- |
| `ArgumentNullException` | Ένα απαιτούμενο όρισμα είναι `null` | ένας `null` handler |
| `ArgumentException` | Μια τιμή που δεν μπορεί να αναγνωστεί | μη έγκυρη έκφραση cron, attribute διάρκειας όπως `"10 minutes"`, το `Backend` δεν έχει οριστεί, μη έγκυρο όνομα πίνακα |
| `ArgumentOutOfRangeException` | Μια τιμή εκτός επιτρεπτού εύρους | `Jitter` ίσο με το μισό του μεσοδιαστήματος ή περισσότερο, `Heartbeat` ίσο με το μισό της μίσθωσης ή περισσότερο, `MaxAttempts` ίσο με 0 |

Εγείρονται όταν δημιουργείται ο scheduler ή όταν προστίθεται η εργασία, ώστε να εντοπίζονται σε ένα test ή κατά την πρώτη εκκίνηση
της εφαρμογής.

## AnarchonException

Το `AnarchonException.Code` είναι ένα `AnarchonErrorCode`. Οι κωδικοί είναι σταθεροί· νέοι κωδικοί μπορεί να προστεθούν σε μια
minor έκδοση, οπότε διατηρείτε έναν default κλάδο όταν κάνετε switch πάνω τους.

| Κωδικός | Σημασία | Διόρθωση |
| --- | --- | --- |
| `Unsupported` | Μια έγκυρη επιλογή που το backend δεν μπορεί να εξυπηρετήσει: επιλογή μίσθωσης χωρίς leases, `HistoryTtl` σε RabbitMQ ή NATS, όνομα εργασίας με χαρακτήρες που δεν υποστηρίζει ο broker | Χρησιμοποιήστε ένα lease backend, ή παραλείψτε την επιλογή |
| `UnsafeJob` | Το `Jitter + MaxLate` δεν είναι μικρότερο από το διάστημα που ένα claim-only backend θυμάται μια εκτέλεση | Μειώστε το `MaxLate`, ή αυξήστε τα `SlotTtl`, `DuplicateWindow`, `ScriptWindow` ή `IdmpDuration` |
| `Server` | Ο server είναι παλιός ή στερείται κάποιας λειτουργίας: Redis πριν την 8.6 με `Idmp`, PostgreSQL πριν την 9.5, nats-server πριν την 2.10 με `Lease` | Αναβαθμίστε, ή επιλέξτε άλλη στρατηγική |
| `State` | Μια κλήση που δεν επιτρέπει η τρέχουσα κατάσταση του scheduler, όπως η `RunNowAsync()` πριν από τη `StartAsync()` | Ξεκινήστε πρώτα τον scheduler |
| `JobExists` | Μια εργασία με αυτό το όνομα είναι ήδη καταχωρημένη τοπικά | Χρησιμοποιήστε άλλο όνομα, ή καλέστε πρώτα τη `Remove()` |
| `UnknownJob` | Δεν υπάρχει καταχωρημένη εργασία με αυτό το όνομα τοπικά | Ελέγξτε το όνομα· οι αναγνώστες χωρίς εργασίες μπορούν ακόμα να καλούν τη `HistoryAsync()` |
| `Store` | Το store αρνήθηκε μια εγγραφή | Ελέγξτε την υγεία και τα δικαιώματα του store |
| `StoreFormat` | Το store περιέχει δεδομένα που γράφτηκαν από νεότερη έκδοση του Anarchon | Αναβαθμίστε κάθε instance, και μην κάνετε rollback πέρα από αυτό το σημείο |

```csharp
try
{
    await scheduler.RunNowAsync(name);
}
catch (AnarchonException error) when (error.Code == AnarchonErrorCode.UnknownJob)
{
    return Results.NotFound(error.Message);
}
```

## Σφάλματα σε handlers

Μια εξαίρεση που εγείρεται από έναν handler δεν διαφεύγει ποτέ εκτός του scheduler: η εκτέλεση καταγράφεται ως `Failed`, με
`"Type: message"` στο `RunRecord.Error`, και το συμβάν `Failed` μεταφέρει την εξαίρεση ως `Cause`.
Η `RunNowAsync()` επιστρέφει αυτή την εγγραφή αντί να εγείρει εξαίρεση.

## Σφάλματα εκτός handlers

Μια διεκδίκηση (claim), ένα heartbeat ή μια εγγραφή ιστορικού που αποτυγχάνει εγείρει το συμβάν `Error` με ένα
`SchedulerErrorEvent`, και ο scheduler συνεχίζει κανονικά· η συγκεκριμένη εκτέλεση παραλείπεται σε αυτό το instance. Εάν δεν
έχει συνδεθεί κάποιος handler, καταγράφεται ως `Error` στο log.

Οι εξαιρέσεις δικτύου και driver (`RedisConnectionException`, `NpgsqlException`, κ.ο.κ.) φτάνουν σε εσάς
όπως είναι, από τη `StartAsync()` και τις μεθόδους ανάγνωσης.
