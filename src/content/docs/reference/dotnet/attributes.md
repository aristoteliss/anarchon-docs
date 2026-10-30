---
title: Attributes (.NET)
description: "[Every], [Cron] and [At], their properties, RegisterOptions, and Duration."
---

The attributes declare jobs on methods. [Attributes](../../../guides/attributes/) is the guide; this
page lists every member. All are in the `Anarchon` namespace.

## The attributes

| Attribute | Constructor | Own properties |
| --- | --- | --- |
| `EveryAttribute` | `[Every(string interval)]`, such as `"10s"` | `Overlap`, `Offset` |
| `CronAttribute` | `[Cron(string expression)]`, 5 or 6 fields | `Overlap`, `TimeZone` (an IANA or Windows ID) |
| `AtAttribute` | `[At(string when)]`, ISO 8601, UTC unless it says otherwise | none |

Every attribute also has the properties of `JobAttribute`:

| Property | Type | As the job option |
| --- | --- | --- |
| `Name` | `string?` | The job's name. Default `Type-Method`, such as `ReportJobs-SyncAsync` |
| `Jitter` | `string?` | `Jitter`. `"0s"` turns it off |
| `MaxLate` | `string?` | `MaxLate` |
| `Timeout` | `string?` | `Timeout` |
| `HistorySize` | `int` | `HistorySize` |
| `HistoryTtl` | `string?` | `HistoryTtl` |
| `MaxAttempts` | `int` | `MaxAttempts` (lease backends) |
| `CatchUp` | `string?` | `CatchUp` (lease backends). `"0s"` turns it off |
| `YieldAfterFailure` | `bool` | `YieldAfterFailure` (lease backends) |

`Overlap` is an `OverlapPolicy`: `Skip` (default) or `Allow`. Text values are read by
`Duration.Parse`; a bad value throws an `ArgumentException` naming the method, when the jobs are
added. See [Job options](../../../guides/job-options/) for what each option does.

## The methods

A job method is a public instance method, inherited ones included, with one attribute. It returns
`Task`, `ValueTask` or `void`, and takes any of `JobContext` and `CancellationToken`, in any order.
Anything else throws an `ArgumentException` when the jobs are added. An override's attributes
replace those of the method it overrides.

## Adding the jobs

| Call | Object per run |
| --- | --- |
| `scheduler.Register(object target, RegisterOptions? options = null)` | The one object given |
| `builder.AddJobs<T>(RegisterOptions? options = null)` | A new `T` from a new service scope. `T` is registered as scoped unless it already is |

## RegisterOptions

| Property | Type | Effect |
| --- | --- | --- |
| `Prefix` | `string?` | Put before every job name: `"eu."` makes `"eu.export"` |
| `TimeZone` | `TimeZoneInfo?` | The time zone of the object's cron jobs that set none |
| `Defaults` | `JobOptions?` | Options for every job of the object, `Data` included. An attribute property overrides them |

The order, for each option: the attribute, then `RegisterOptions.Defaults`, then the scheduler.

## Duration

| Member | Does |
| --- | --- |
| `Duration.Parse(string value)` → `TimeSpan` | Reads `"500ms"`, `"10s"`, `"35m"`, `"1h30m"`, `"2d"`, `"1.5h"`, or milliseconds as digits. Not positive, or not a duration: `ArgumentException` |
| `Duration.Format(TimeSpan value)` → `string` | Writes a duration the way `Parse` reads it: `"1h30m"` |

`Duration.Parse` is also handy for durations in configuration files:
`Duration.Parse(configuration["Jobs:ExportTimeout"] ?? "5m")`.
