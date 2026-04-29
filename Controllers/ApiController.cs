using HealthcareApp.Models;
using Microsoft.AspNetCore.Mvc;

namespace HealthcareApp.Controllers;

[ApiController]
[Route("api")]
public class ApiController : ControllerBase
{
    private readonly HealthcareDataStore _store;

    public ApiController(HealthcareDataStore store)
    {
        _store = store;
    }

    // ── Patients ──────────────────────────────────────────────────────────

    [HttpGet("patients")]
    public IActionResult GetPatients() =>
        Ok(_store.GetPatients());

    [HttpPost("patients/{id}/notes")]
    public IActionResult SaveNotes(string id, [FromBody] NotesPayload payload)
    {
        var patient = _store.GetPatient(id);
        if (patient == null) return NotFound();
        patient.Notes = payload.Notes ?? "";
        _store.UpdatePatient(patient);
        return Ok(new { success = true });
    }

    [HttpPost("patients/{id}/add-note")]
    public IActionResult AddNote(string id, [FromBody] AddNotePayload payload)
    {
        var patient = _store.GetPatient(id);
        if (patient == null) return NotFound();
        var entry = payload.Text?.Trim() ?? "";
        patient.Notes = string.IsNullOrWhiteSpace(patient.Notes)
            ? entry
            : entry + "\n" + patient.Notes;
        _store.UpdatePatient(patient);
        return Ok(new { success = true });
    }

    [HttpPost("patients/{id}/status")]
    public IActionResult ChangeStatus(string id, [FromBody] StatusPayload payload)
    {
        var patient = _store.GetPatient(id);
        if (patient == null) return NotFound();
        patient.Status = payload.Status ?? patient.Status;
        _store.UpdatePatient(patient);
        return Ok(new { id = patient.Id, status = patient.Status });
    }

    // ── Alerts ────────────────────────────────────────────────────────────

    [HttpGet("alerts")]
    public IActionResult GetAlerts() =>
        Ok(_store.GetAlerts());

    // ── Today's Appointments (Home page grid) ────────────────────────────

    [HttpGet("today-appointments")]
    public IActionResult GetTodayAppointments() =>
        Ok(_store.GetTodayAppointments());

    // ── Schedule Appointments (Kendo Scheduler CRUD) ─────────────────────

    [HttpGet("appointments")]
    public IActionResult GetAppointments()
    {
        var list = _store.GetScheduleAppointments();
        return Ok(list.Select(MapAppt));
    }
    // ── Analytics ─────────────────────────────────────────────────────────

    [HttpGet("analytics")]
    public IActionResult GetAnalytics() =>
        Ok(_store.GetAnalytics());

    // ── Tasks ─────────────────────────────────────────────────────────────

    [HttpGet("tasks")]
    public IActionResult GetTasks() =>
        Ok(_store.GetTasks());

    [HttpPost("tasks/create")]
    public IActionResult CreateTask([FromBody] DailyTask task)
    {
        if (task == null || string.IsNullOrWhiteSpace(task.Task))
            return BadRequest("Task name is required.");

        task.Task = task.Task.Trim();
        return Ok(_store.AddTask(task));
    }

    [HttpPost("tasks/update")]
    public IActionResult UpdateTask([FromBody] DailyTask task)
    {
        if (!_store.UpdateTask(task))
            return NotFound();
        return Ok(task);
    }

    // ── Profile ───────────────────────────────────────────────────────────

    [HttpGet("profile")]
    public IActionResult GetProfile() =>
        Ok(_store.GetProfile());

    [HttpPost("profile/update")]
    public IActionResult UpdateProfile([FromBody] DoctorProfilePayload payload)
    {
        if (payload == null)
            return BadRequest();

        var profile = _store.GetProfile();
        profile.FullName = string.IsNullOrWhiteSpace(payload.FullName) ? profile.FullName : payload.FullName.Trim();
        profile.Email    = string.IsNullOrWhiteSpace(payload.Email) ? profile.Email : payload.Email.Trim();
        profile.Phone    = string.IsNullOrWhiteSpace(payload.Phone) ? profile.Phone : payload.Phone.Trim();

        return Ok(_store.UpdateProfile(profile));
    }

    [HttpPost("profile/avatar")]
    public IActionResult UpdateProfileAvatar([FromBody] AvatarPayload payload)
    {
        if (payload == null || string.IsNullOrWhiteSpace(payload.Avatar))
            return BadRequest();

        return Ok(_store.UpdateProfileAvatar(payload.Avatar.Trim()));
    }

    // ── Mapping helpers ───────────────────────────────────────────────────

    private static object MapAppt(ScheduleAppointment a) => new
    {
        a.Id,
        a.Title,
        a.PatientName,
        a.Reason,
        a.Room,
        a.EventType,
        Start = a.Start.ToString("o"),
        End   = a.End.ToString("o"),
    };
}

// ── DTOs ──────────────────────────────────────────────────────────────────

public record NotesPayload(string? Notes);
public record AddNotePayload(string? Text);
public record StatusPayload(string? Status);
public record DoctorProfilePayload(string? FullName, string? Email, string? Phone);
public record AvatarPayload(string? Avatar);
