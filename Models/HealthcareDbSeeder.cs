namespace HealthcareApp.Models;

using Microsoft.EntityFrameworkCore;

/// <summary>
/// Seeds the SQLite database on first run using the deterministic data from
/// HealthcareDataRepository. If the DB already has data it is left untouched.
/// </summary>
public static class HealthcareDbSeeder
{
    public static void Seed(HealthcareDbContext ctx)
    {
        ctx.Database.EnsureCreated();

        // ── Schema migrations (idempotent) ───────────────────────────────
        // EnsureCreated never alters an existing schema, so we apply any
        // additive column changes manually via raw SQL.
        var conn = ctx.Database.GetDbConnection();
        conn.Open();
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "PRAGMA table_info(DailyTasks)";
            bool hasDescription = false;
            using (var reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    if (string.Equals(reader.GetString(1), "Description", System.StringComparison.OrdinalIgnoreCase))
                    { hasDescription = true; break; }
                }
            }
            if (!hasDescription)
            {
                cmd.CommandText = "ALTER TABLE DailyTasks ADD COLUMN Description TEXT NOT NULL DEFAULT ''";
                cmd.ExecuteNonQuery();
            }
        }

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
