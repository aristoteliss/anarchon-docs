---
title: Hosting (.NET)
description: AddAnarchon(), the Use* backend methods, AddJobs<T>(), and named schedulers.
---

The hosting API registers a scheduler in `IServiceCollection` and lets the host start and stop it.
It works in any app built on `Microsoft.Extensions.Hosting`: ASP.NET Core, worker services, and
console apps with a host. See the [ASP.NET Core](../../../recipes/aspnet-core/) and
[Worker service](../../../recipes/worker-service/) recipes.

```csharp
builder.Services
    .AddAnarchon(options => options.TimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Athens"))
    .UseRedis(builder.Configuration.GetConnectionString("redis")!)
    .AddJobs<ReportJobs>();
```

## AddAnarchon

In the `Microsoft.Extensions.DependencyInjection` namespace.

| Overload | Registers |
| --- | --- |
| `AddAnarchon()` | The default `Scheduler`, a singleton |
| `AddAnarchon(Action<SchedulerOptions> configure)` | The same, with options |
| `AddAnarchon(string name, Action<SchedulerOptions>? configure = null)` | A named scheduler, a keyed singleton: `[FromKeyedServices("name")] Scheduler` |

Each also registers a hosted service that calls `StartAsync()` when the host starts and
`StopAsync()` when it stops. The options are named options (`IOptions<SchedulerOptions>`), so
`services.Configure<SchedulerOptions>(...)` adds to them. Calling `AddAnarchon()` again with the
same name only adds options. The host's `ILoggerFactory` and `TimeProvider` are used unless the
options set their own.

## AnarchonBuilder

What `AddAnarchon()` returns. Each method returns the builder.

| Member | Does |
| --- | --- |
| `UseBackend(Func<IServiceProvider, IBackend> factory)` | Sets the backend, created once from the container |
| `AddJobs<T>(RegisterOptions? options = null)` | Adds the jobs `T` declares with [attributes](../attributes/). `T` is registered as scoped unless it already is; each run gets a new scope and a new `T` from it |
| `Services` | The service collection |
| `Name` | The scheduler's name, empty for the default |

## The backend methods

Each backend package adds three overloads to `AnarchonBuilder`:

| Package | Methods |
| --- | --- |
| `Anarchon.Redis` | `UseRedis(string configuration)`, `UseRedis(Action<RedisBackendOptions>)`, `UseRedis(Action<IServiceProvider, RedisBackendOptions>)` |
| `Anarchon.Postgres` | `UsePostgres(string connectionString)`, and the two option forms |
| `Anarchon.Sqlite` | `UseSqlite(string connectionString)`, and the two option forms |
| `Anarchon.RabbitMQ` | `UseRabbitMQ(string connectionString)`, and the two option forms |
| `Anarchon.Nats` | `UseNats(string connectionString)`, and the two option forms |

The form with `IServiceProvider` takes clients the app already registered, which the scheduler then
never closes:

```csharp
builder.Services.AddNpgsqlDataSource(builder.Configuration.GetConnectionString("app")!);
builder.Services.AddAnarchon()
    .UsePostgres((services, options) => options.DataSource = services.GetRequiredService<NpgsqlDataSource>());
```

## Errors at start-up

The scheduler and its backend are created when first resolved, which the hosted service does as
the host starts. Bad options throw then, and a store that can't be reached makes `StartAsync()`,
and so the host's start, fail. A host that starts is a host whose scheduler is connected.

## Without a host

Nothing here is required: `new Scheduler(options)` with `StartAsync()`, `StopAsync()` and
`Register()` works in any program. See [Lifecycle](../../../guides/lifecycle/).
