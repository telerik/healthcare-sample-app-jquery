namespace HealthcareApp.Models;

/// <summary>
/// Singleton that holds the master read-only copy of all data as loaded from
/// SQLite at startup. HealthcareDataStore deep-copies from here into each
/// per-session UserSessionData, so the originals are never mutated.
/// </summary>
public class HealthcareSeedStore
{
    public IReadOnlyList<PatientRecord>       Patients     { get; }
    public IReadOnlyList<ScheduleAppointment> Appointments { get; }
    public IReadOnlyList<DailyTask>           Tasks        { get; }

    public HealthcareSeedStore(HealthcareDbContext db)
    {
        // Avatar is [NotMapped] and not stored in the DB.
        // Populate it from the deterministic in-memory data after loading patients.
        var freshAvatars = HealthcareDataRepository.GetPatients()
            .ToDictionary(p => p.Id, p => p.Avatar);

        var patients = db.Patients.ToList();
        foreach (var p in patients)
        {
            if (freshAvatars.TryGetValue(p.Id, out var localAvatar))
                p.Avatar = localAvatar;
        }

        Patients     = patients.AsReadOnly();
        Appointments = db.ScheduleAppointments.ToList().AsReadOnly();
        Tasks        = db.DailyTasks.ToList().AsReadOnly();
    }
}
