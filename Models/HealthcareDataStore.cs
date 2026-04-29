using Microsoft.AspNetCore.Http;

namespace HealthcareApp.Models;

/// <summary>
/// Scoped service that provides per-session isolated data.
///
/// On first access within a browser session the master lists (loaded from
/// SQLite by the singleton seed store) are deep-copied into a
/// UserSessionData entry keyed by the ASP.NET session ID.
/// All subsequent reads and mutations within that session hit only that
/// private copy — no other session is affected.
///
/// This mirrors the IUserDataCache / IHttpContextAccessor pattern used in
/// the Kendo UI demos service.
/// </summary>
public class HealthcareDataStore
{
    private readonly IUserDataCache        _cache;
    private readonly IHttpContextAccessor  _http;
    private readonly HealthcareSeedStore   _seed;

    public HealthcareDataStore(
        IUserDataCache       cache,
        IHttpContextAccessor http,
        HealthcareSeedStore  seed)
    {
        _cache = cache;
        _http  = http;
        _seed  = seed;
    }

    // ── Resolve the per-session data bag ──────────────────────────────────

    private UserSessionData Session()
    {
        // Ensure there is an ASP.NET session and it has an ID
        var httpCtx = _http.HttpContext
            ?? throw new InvalidOperationException("No active HTTP context.");

        httpCtx.Session.SetString("_init", "1"); // touches the session to assign an ID
        var sessionId = httpCtx.Session.Id;

        return _cache.GetOrCreate(sessionId, () => new UserSessionData
        {
            // Deep-copy from the shared seed so edits are fully isolated
            Patients = _seed.Patients.Select(DeepCopyPatient).ToList(),
            Tasks    = _seed.Tasks.Select(ShallowCopyTask).ToList(),
            Profile  = new DoctorProfile(),
        });
    }

    // ── Patients ──────────────────────────────────────────────────────────

    public List<PatientRecord> GetPatients()     => Session().Patients.ToList();
    public PatientRecord? GetPatient(string id)  => Session().Patients.FirstOrDefault(p => p.Id == id);

    public void UpdatePatient(PatientRecord updated)
    {
        var list = Session().Patients;
        var idx  = list.FindIndex(p => p.Id == updated.Id);
        if (idx < 0) return;

        list[idx].Status = updated.Status;
        list[idx].Notes  = updated.Notes;
        list[idx].Doctor = updated.Doctor;
    }

    public DoctorProfile GetProfile() => new()
    {
        FullName = Session().Profile.FullName,
        Email    = Session().Profile.Email,
        Phone    = Session().Profile.Phone,
        Avatar   = Session().Profile.Avatar,
    };

    public DoctorProfile UpdateProfile(DoctorProfile updated)
    {
        var profile = Session().Profile;
        profile.FullName = updated.FullName;
        profile.Email    = updated.Email;
        profile.Phone    = updated.Phone;
        profile.Avatar   = updated.Avatar;
        return GetProfile();
    }

    public DoctorProfile UpdateProfileAvatar(string avatar)
    {
        var profile = Session().Profile;
        profile.Avatar = avatar;
        return GetProfile();
    }

    // ── Schedule Appointments ─────────────────────────────────────────────

    public IReadOnlyList<ScheduleAppointment> GetScheduleAppointments() =>
        HealthcareDataRepository.BuildInitialScheduleAppointments(_seed.Patients.ToList()).AsReadOnly();
    
    // ── Daily Tasks ───────────────────────────────────────────────────────

    public List<DailyTask> GetTasks() => Session().Tasks.ToList();

    public bool UpdateTask(DailyTask updated)
    {
        var list = Session().Tasks;
        var idx  = list.FindIndex(t => t.Id == updated.Id);
        if (idx < 0) return false;

        list[idx].Task        = updated.Task;
        list[idx].Description = updated.Description;
        list[idx].Priority = updated.Priority;
        list[idx].Done     = updated.Done;
        return true;
    }

    public DailyTask AddTask(DailyTask task)
    {
        var list = Session().Tasks;
        task.Task = (task.Task ?? string.Empty).Trim();
        task.Id   = list.Count > 0 ? list.Max(t => t.Id) + 1 : 1;
        task.Done = false;
        list.Insert(0, task);
        return task;
    }

    // ── Derived / computed ────────────────────────────────────────────────

    public List<PatientAlert>                   GetAlerts()          => HealthcareDataRepository.GetAlerts(GetPatients()).ToList();
    public Dictionary<string, PatientAnalytics> GetAnalytics()       => HealthcareDataRepository.GetAnalyticsData(GetPatients());
    public List<TodayAppointment>               GetTodayAppointments() => HealthcareDataRepository.GetTodayAppointments(GetPatients()).ToList();

    // ── Copy helpers ──────────────────────────────────────────────────────

    private static PatientRecord DeepCopyPatient(PatientRecord p) => new()
    {
        Id        = p.Id,        Name      = p.Name,      Age       = p.Age,
        Gender    = p.Gender,    BloodType = p.BloodType, Ward      = p.Ward,
        Diagnosis = p.Diagnosis, Status    = p.Status,    Doctor    = p.Doctor,
        Phone     = p.Phone,     LastVisit = p.LastVisit, Avatar    = p.Avatar,
        Notes     = p.Notes,     RiskScore = p.RiskScore,
        Allergies  = [.. p.Allergies],
        Vitals     = new PatientVitals
        {
            Bp = p.Vitals.Bp, Systolic = p.Vitals.Systolic, Diastolic = p.Vitals.Diastolic,
            Hr = p.Vitals.Hr, Temp = p.Vitals.Temp, Spo2 = p.Vitals.Spo2,
            Weight = p.Vitals.Weight, Rr = p.Vitals.Rr
        },
        Labs        = p.Labs.Select(l        => new LabResult       { Test = l.Test, Result = l.Result, Flag = l.Flag, Date = l.Date, Reference = l.Reference, Status = l.Status, Note = l.Note }).ToList(),
        Medications = p.Medications.Select(m => new PatientMedication{ Drug = m.Drug, Dose = m.Dose, Frequency = m.Frequency, Duration = m.Duration }).ToList(),
        Visits      = p.Visits.Select(v      => new PatientVisit    { Date = v.Date, Reason = v.Reason }).ToList(),
        AdmissionDetails = new AdmissionInfo
        {
            Department = p.AdmissionDetails.Department, WardUnit = p.AdmissionDetails.WardUnit,
            Room = p.AdmissionDetails.Room, AdmissionDate = p.AdmissionDetails.AdmissionDate,
            AssignedNurse = p.AdmissionDetails.AssignedNurse
        }
    };

    private static DailyTask ShallowCopyTask(DailyTask t) => new()
    {
        Id = t.Id, Task = t.Task, Priority = t.Priority, Done = t.Done
    };
}

public class DailyTask
{
    public int    Id          { get; set; }
    public string Task        { get; set; } = "";
    public string Priority    { get; set; } = "Medium";
    public bool   Done        { get; set; }
    public string Description { get; set; } = "";
}

