---
title: Errors (.NET)
description: The exceptions the .NET scheduler throws, the AnarchonErrorCode values, and how to fix each.
---

The .NET scheduler throws standard exceptions for bad arguments, and `AnarchonException` for the
rest. The Node.js errors are in [Errors](../../errors/).

## Bad arguments

| Exception | When | Example |
| --- | --- | --- |
| `ArgumentNullException` | A required argument is `null` | a `null` handler |
| `ArgumentException` | A value that can't be read | an invalid cron expression, a duration attribute such as `"10 minutes"`, `Backend` not set, a bad table name |
| `ArgumentOutOfRangeException` | A value out of its range | `Jitter` of half the interval or more, `Heartbeat` of half the lease or more, `MaxAttempts` of 0 |

They are thrown when the scheduler is created or the job is added, so a test or the first start of
the app finds them.

## AnarchonException

`AnarchonException.Code` is an `AnarchonErrorCode`. Codes are stable; new ones may be added in a
minor release, so keep a default branch when you switch over them.

| Code | Means | Fix |
| --- | --- | --- |
| `Unsupported` | A valid option the backend can't honour: a lease option without leases, `HistoryTtl` on RabbitMQ or NATS, a job name with characters a broker can't use | Use a lease backend, or drop the option |
| `UnsafeJob` | `Jitter + MaxLate` is not shorter than how long a claim-only backend remembers a run | Lower `MaxLate`, or raise `SlotTtl`, `DuplicateWindow`, `ScriptWindow` or `IdmpDuration` |
| `Server` | The server is too old or lacks a feature: Redis before 8.6 with `Idmp`, PostgreSQL before 9.5, nats-server before 2.10 with `Lease` | Upgrade, or choose another strategy |
| `State` | A call the scheduler's state doesn't allow, such as `RunNowAsync()` before `StartAsync()` | Start the scheduler first |
| `JobExists` | A job with that name is already registered here | Use another name, or `Remove()` it first |
| `UnknownJob` | No job with that name is registered here | Check the name; readers without jobs can still call `HistoryAsync()` |
| `Store` | The store refused a write | Check the store's health and permissions |
| `StoreFormat` | The store holds data a newer version of Anarchon wrote | Upgrade every instance, then roll back no further |

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

## Errors in handlers

An exception thrown by a handler never leaves the scheduler: the run is recorded as `Failed`, with
`"Type: message"` in `RunRecord.Error`, and the `Failed` event carries the exception as `Cause`.
`RunNowAsync()` returns that record rather than throwing.

## Errors outside handlers

A claim, heartbeat or history write that fails raises the `Error` event with a
`SchedulerErrorEvent`, and the scheduler carries on; that run is skipped on this instance. With no
handler attached, it is logged at `Error` instead.

Network and driver exceptions (`RedisConnectionException`, `NpgsqlException`, and so on) reach you
as they are, from `StartAsync()` and the read methods.
