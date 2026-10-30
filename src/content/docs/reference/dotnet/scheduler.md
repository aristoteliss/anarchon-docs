---
title: Scheduler (.NET)
description: Every method, property and event of the .NET Scheduler class.
---

`Anarchon.Scheduler`, from the `Anarchon` package. The Node.js class is described in
[Scheduler](../../scheduler/).

```csharp
await using var scheduler = new Scheduler(new SchedulerOptions { Backend = new RedisBackend("localhost:6379") });
scheduler.Every("sync", TimeSpan.FromSeconds(10), ctx => SyncAsync(ctx.CancellationToken));
await scheduler.StartAsync();
```

## Constructor

| Signature | Notes |
| --- | --- |
| `Scheduler(SchedulerOptions options)` | Checks the options and opens nothing. `Backend` is required. See [Options](../options/) |

Throws `ArgumentException` or `ArgumentOutOfRangeException` for a bad value, and
`AnarchonException` (`Unsupported`) for `Lease` or `Heartbeat` on a backend without leases.

## Adding and removing jobs

Each method returns the scheduler, so calls chain. Jobs can be added before or after `StartAsync()`.

| Method | Adds |
| --- | --- |
| `Every(string name, TimeSpan interval, Func<JobContext, Task> handler, EveryJobOptions? options = null)` | A job on a fixed grid from the Unix epoch, in UTC |
| `Cron(string name, string expression, Func<JobContext, Task> handler, CronJobOptions? options = null)` | A cron job: 5 fields, or 6 with seconds first. Parsed by Cronos |
| `At(string name, DateTimeOffset when, Func<JobContext, Task> handler, JobOptions? options = null)` | A one-off job |
| `Register(object target, RegisterOptions? options = null)` | Every job declared with [attributes](../attributes/) on the object's methods, or none |
| `Remove(string name)` → `bool` | Removes a job here. A run in progress here finishes. `false` when no job has that name |

A name that is already registered throws `AnarchonException` (`JobExists`), and an empty name an
`ArgumentException`. RabbitMQ and NATS accept only letters, digits, `_` and `-` (`Unsupported`).

## Starting and stopping

| Method | Does |
| --- | --- |
| `StartAsync(CancellationToken = default)` → `Task` | Connects, prepares each job, recovers and catches up runs, and arms the timers. If it fails, the backend is closed and `StartAsync()` can be called again |
| `StopAsync(CancellationToken = default)` → `Task` | Stops the timers, cancels running jobs' tokens, waits up to `StopTimeout` (or until the token is cancelled), then closes what the backend opened. Safe to call twice |
| `DisposeAsync()`, `Dispose()` | The same as `StopAsync()` |

With a host, `AddAnarchon()` calls both for you. See [Hosting](../hosting/).

## Running and reading

| Member | Returns |
| --- | --- |
| `RunNowAsync(string name, object? data = null)` | `Task<RunRecord>`: runs the job here, now, once it has finished. A manual run doesn't take part in the schedule. `data` replaces the job's [run data](../../../guides/run-data/) for this run. Needs `StartAsync()` first (`State`) |
| `HistoryAsync(string name, int limit = 20, CancellationToken = default)` | `Task<IReadOnlyList<RunRecord>>`: runs from every instance, newest first, one record per attempt. Works for any job name, without `StartAsync()` |
| `LastRunAsync(string name, CancellationToken = default)` | `Task<RunRecord?>`: the newest record, or `null` |
| `GetNextRun(string name)` | `DateTimeOffset?`: the next scheduled time, or `null` when there is none, such as a one-off job whose time has passed. Unknown name: `UnknownJob` |
| `GetJobs()` | `IReadOnlyList<JobInfo>`: the jobs registered here |
| `SetData(object? data)` | The scheduler. Replaces the scheduler-wide run data |
| `Backend` | `IBackend`: `Backend.Name` is `"redis:lease"`, `"postgres"`, `"sqlite"`, `"rabbitmq"`, `"nats"` or `"nats:lease"` |
| `InstanceId` | `string`: this instance's ID |

`JobInfo` has `Name`, `Type` (`JobType.Every`, `Cron`, `Once`), `Schedule` (text), `NextRunAt` and
`RunningHere` (how many runs of the job are executing here).

## Events

Standard .NET events. A handler that throws is logged and never affects the run. See
[Events](../events/).

| Event | Arguments |
| --- | --- |
| `Started` | `RunStartEvent` |
| `Succeeded` | `RunRecord` |
| `Failed` | `RunFailureEvent` |
| `Interrupted` | `RunInterruptedEvent` |
| `Skipped` | `SkipEvent` |
| `Lost` | `LostEvent` |
| `Error` | `SchedulerErrorEvent` |

## JobContext

What a handler receives.

| Property | Type | Meaning |
| --- | --- | --- |
| `Name` | `string` | The job's name |
| `Slot` | `long` | The scheduled time in Unix ms: with the name, the run's identity. Same on every attempt |
| `ScheduledAt` | `DateTimeOffset` | The scheduled time, not when the handler started |
| `InstanceId` | `string` | This instance |
| `Attempt` | `int` | 1, or more after a takeover |
| `Reason` | `RunReason` | `Scheduled`, `Manual`, `CatchUp` or `Takeover` |
| `IsManual` | `bool` | Started by `RunNowAsync()` |
| `CancellationToken` | `CancellationToken` | Cancelled on timeout, on `StopAsync()`, and when the lease is lost |
| `Data` | `object?` | The run data |
| `GetData<T>()` | `T` | The run data as `T`; another type fails the run with both types named |

## RunRecord

One attempt of a run, from `HistoryAsync()`, `LastRunAsync()`, `RunNowAsync()` and `Succeeded`.

| Property | Type |
| --- | --- |
| `Job`, `Slot`, `ScheduledAt`, `InstanceId` | as on the context |
| `Attempt`, `Reason`, `IsManual` | as on the context |
| `Status` | `RunStatus`: `Running`, `Success`, `Failed`, `Interrupted` |
| `StartedAt`, `FinishedAt` | `DateTimeOffset`, `DateTimeOffset?` |
| `Duration` | `TimeSpan?` |
| `Error` | `string?`: `"Type: message"` of a failed run |
