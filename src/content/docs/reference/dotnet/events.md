---
title: Events (.NET)
description: Every event of the .NET Scheduler, its arguments, and the log messages.
---

Events are standard .NET events on `Scheduler`. [Events and logging](../../../guides/events-and-logging/)
shows how to use them; the Node.js events are in [Events](../../events/).

```csharp
scheduler.Failed += (_, e) => logger.LogError(e.Cause, "{Job} failed on attempt {Attempt}", e.Job, e.Attempt);
```

Keep handlers quick: they run inside the scheduler's work on the run. If one throws, the exception
is logged and the run is not affected.

## The events

| Event | Raised when | Arguments |
| --- | --- | --- |
| `Started` | This instance starts a run | `RunStartEvent` |
| `Succeeded` | A run here finished | `RunRecord` |
| `Failed` | A run here threw, or timed out | `RunFailureEvent` |
| `Interrupted` | A run here ended after `StopAsync()` or a lost lease cancelled its token | `RunInterruptedEvent` |
| `Skipped` | This instance didn't run a due run | `SkipEvent` |
| `Lost` | A run here couldn't renew its lease, and a backup may take it over | `LostEvent` |
| `Error` | Something failed outside a handler, such as a claim the store refused | `SchedulerErrorEvent` |

## The arguments

Every run event has `Job`, `Slot`, `ScheduledAt` and `InstanceId` (from `RunEvent`).

| Type | Adds |
| --- | --- |
| `RunStartEvent` | `Attempt`, `Reason` (`RunReason`), `IsManual` |
| `RunRecord` | `Attempt`, `Reason`, `IsManual`, `Status`, `StartedAt`, `FinishedAt`, `Duration`, `Error` |
| `RunFailureEvent` | The fields of `RunRecord`, and `Cause`: the exception |
| `RunInterruptedEvent` | The fields of `RunRecord`, `Cause`, and `HandedOver`: whether the run was given up on stop, so a backup takes it over at once |
| `SkipEvent` | `Reason` (`SkipReason.Taken`, `Late` or `Overlap`), `Late`: how late this instance was |
| `LostEvent` | `Attempt` |
| `SchedulerErrorEvent` | `Job` and `Slot` (when the error concerns a run), `Error`: the exception |

`SkipReason.Taken` is the normal case on every instance but the winner. Count it, but don't alert
on it.

## Log messages

With a `LoggerFactory` (a host sets it), the scheduler logs under the category
`Anarchon.Scheduler`:

| Event ID | Level | Message |
| --- | --- | --- |
| 1 | Debug | `{Job} @ {Due}: started on {Instance} (attempt {Attempt}, {Reason})` |
| 2 | Debug | `{Job} @ {Due}: finished in {DurationMs} ms` |
| 3 | Warning | `{Job} @ {Due}: failed after {DurationMs} ms: {Error}` |
| 4 | Debug | `{Job} @ {Due}: interrupted after {DurationMs} ms (handed over: {HandedOver})` |
| 5 | Debug | `{Job} @ {Due}: skipped ({Reason})` |
| 6 | Warning | `{Job} @ {Due}: attempt {Attempt} was taken over by a backup` |
| 7 | Error | `Error in {Subject}: {Message}`, when no handler is attached to `Error` |
| 8 | Error | `A {Event} handler threw` |
| 9 | Warning | `Closing {Backend} failed` |

The messages are structured: `Job`, `Due`, `Instance` and the others are properties a log sink can
filter on.
