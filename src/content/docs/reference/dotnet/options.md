---
title: Options (.NET)
description: Every property of SchedulerOptions and of the job options classes, with defaults.
---

The options of the .NET scheduler and its jobs. [Scheduler options](../../../guides/scheduler-options/)
and [Job options](../../../guides/job-options/) explain each one; the backends' options are on each
[backend's page](../../../backends/overview/).

## SchedulerOptions

| Property | Type | Default | Notes |
| --- | --- | --- | --- |
| `Backend` | `IBackend?` | required | The store |
| `InstanceId` | `string?` | `machine:pid` | A pod or host name reads better |
| `Data` | `object?` | none | Run data for every job; a `JobDataProvider` is called at each run |
| `Jitter` | `TimeSpan` | 2 s | Capped at a quarter of a job's interval unless a job sets its own |
| `MaxLate` | `TimeSpan` | 60 s | Must be bigger than the jitter |
| `HistorySize` | `int` | 1000 | Runs kept per job, about |
| `HistoryTtl` | `TimeSpan?` | none | Also drop older records. Not on RabbitMQ or NATS |
| `TimeZone` | `TimeZoneInfo?` | the server's local zone | For cron jobs. Set it |
| `Lease` | `TimeSpan?` | 30 s | Lease backends only |
| `Heartbeat` | `TimeSpan?` | 5 s, or a sixth of `Lease` if smaller | Under half of `Lease`. Lease backends only |
| `StopTimeout` | `TimeSpan` | 30 s | How long `StopAsync()` waits for running jobs |
| `LoggerFactory` | `ILoggerFactory?` | none; the host's with `AddAnarchon()` | Category `Anarchon.Scheduler` |
| `TimeProvider` | `TimeProvider?` | `TimeProvider.System`; the container's with `AddAnarchon()` | The scheduler's clock and timers |

## Job options

The classes nest: `JobOptions` for `At()`, `RecurringJobOptions` adds `Overlap`,
`EveryJobOptions` and `CronJobOptions` add one property each. Every property is nullable: `null`
takes the scheduler's value or the default.

| Property | Class | Type | Default |
| --- | --- | --- | --- |
| `Jitter` | `JobOptions` | `TimeSpan?` | the scheduler's, at most a quarter of the interval. Under half of it |
| `MaxLate` | `JobOptions` | `TimeSpan?` | the scheduler's |
| `Timeout` | `JobOptions` | `TimeSpan?` | no limit |
| `HistorySize` | `JobOptions` | `int?` | the scheduler's |
| `HistoryTtl` | `JobOptions` | `TimeSpan?` | the scheduler's |
| `Data` | `JobOptions` | `object?` | the scheduler's, merged when both are dictionaries |
| `MaxAttempts` | `JobOptions` | `int?` | 3, from 1 to 100. Lease backends only |
| `CatchUp` | `JobOptions` | `TimeSpan?` | 5 minutes. Lease backends only |
| `YieldAfterFailure` | `JobOptions` | `bool?` | `false`. Lease backends only |
| `Overlap` | `RecurringJobOptions` | `OverlapPolicy?` | `Skip`. Lease backends only |
| `Offset` | `EveryJobOptions` | `TimeSpan?` | zero: shifts the grid |
| `TimeZone` | `CronJobOptions` | `TimeZoneInfo?` | the scheduler's |

A lease-only option on a backend without leases throws `AnarchonException` (`Unsupported`) when the
job is added, so a setting is never silently ignored.

## The Node.js names

| Node.js | .NET |
| --- | --- |
| `jitterMs`, `maxLateMs`, `timeoutMs` | `Jitter`, `MaxLate`, `Timeout` |
| `catchUpMs`, `historyTtlMs`, `offsetMs` | `CatchUp`, `HistoryTtl`, `Offset` |
| `leaseMs`, `heartbeatMs` | `Lease`, `Heartbeat` |
| `overlap: 'skip'` | `Overlap = OverlapPolicy.Skip` |
| `timezone: 'Europe/Athens'` | `TimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Athens")` |
| `stop({ timeoutMs })` | `StopTimeout` |
| `log: true` | `LoggerFactory` |
| `unrefTimers` | none |
