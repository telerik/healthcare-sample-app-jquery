using System.Collections.Concurrent;

namespace HealthcareApp.Models;

/// <summary>
/// Holds one isolated copy of the mutable data for a single browser session.
/// Created on first access and kept alive as long as the session is valid.
/// </summary>
public class UserSessionData
{
    public List<PatientRecord> Patients { get; set; } = [];
    public List<DailyTask>     Tasks    { get; set; } = [];
    public DoctorProfile       Profile  { get; set; } = new();
}

/// <summary>
/// Singleton dictionary that maps session IDs to their per-user data copies.
/// Mirrors the IUserDataCache pattern from the Kendo UI demos service.
/// </summary>
public interface IUserDataCache
{
    UserSessionData GetOrCreate(string sessionId, Func<UserSessionData> factory);
}

public class UserDataCache : IUserDataCache
{
    private readonly ConcurrentDictionary<string, UserSessionData> _store = new();

    public UserSessionData GetOrCreate(string sessionId, Func<UserSessionData> factory)
        => _store.GetOrAdd(sessionId, _ => factory());
}
