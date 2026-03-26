namespace HealthcareApp.Models;

/// <summary>
/// Seeds the SQLite database on first run using the deterministic data from
/// HealthcareDataRepository. If the DB already has data it is left untouched.
/// </summary>
public static class HealthcareDbSeeder
{
    public static void Seed(HealthcareDbContext ctx)
    {
        ctx.Database.EnsureCreated();

        // ── Patients ─────────────────────────────────────────────────────
        if (!ctx.Patients.Any())
        {
            var patients = HealthcareDataRepository.GetPatients();
            ctx.Patients.AddRange(patients);
        }

        // ── Schedule Appointments ────────────────────────────────────────
        if (!ctx.ScheduleAppointments.Any())
        {
            // Build appointments from already-added patients (before SaveChanges
            // patients exist in the change-tracker so we can read them here).
            var patients = ctx.ChangeTracker
                .Entries<PatientRecord>()
                .Select(e => e.Entity)
                .ToList();

            if (patients.Count == 0)
                patients = HealthcareDataRepository.GetPatients().ToList();

            var appts = HealthcareDataRepository.BuildInitialScheduleAppointments(patients);
            ctx.ScheduleAppointments.AddRange(appts);
        }

        // ── Daily Tasks ──────────────────────────────────────────────────
        if (!ctx.DailyTasks.Any())
        {
            var patients = ctx.ChangeTracker
                .Entries<PatientRecord>()
                .Select(e => e.Entity)
                .ToList();

            if (patients.Count == 0)
                patients = HealthcareDataRepository.GetPatients().ToList();

            var tasks = HealthcareDataRepository.BuildInitialDailyTasks(patients);
            ctx.DailyTasks.AddRange(tasks);
        }

        ctx.SaveChanges();
    }
}
