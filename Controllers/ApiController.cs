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
        // Kendo Scheduler needs ISO 8601 date strings
        return Ok(list.Select(MapAppt));
    }

    [HttpPost("appointments/update")]
    public IActionResult UpdateAppointment([FromBody] ScheduleAppointmentDto dto)
    {
        var appt = MapDto(dto);
        if (!_store.UpdateScheduleAppointment(appt))
            return NotFound();
        return Ok(MapAppt(appt));
    }

    [HttpPost("appointments/destroy")]
    public IActionResult DeleteAppointment([FromBody] ScheduleAppointmentDto dto)
    {
        if (!_store.DeleteScheduleAppointment(dto.Id))
            return NotFound();
        return Ok(new { success = true });
    }

    // ── Analytics ─────────────────────────────────────────────────────────

    [HttpGet("analytics")]
    public IActionResult GetAnalytics() =>
        Ok(_store.GetAnalytics());

    [HttpGet("analytics/{patientId}")]
    public IActionResult GetPatientAnalytics(string patientId)
    {
        var data = _store.GetAnalytics();
        if (!data.TryGetValue(patientId, out var analytics))
            return NotFound();
        return Ok(analytics);
    }

    // ── Event Types & Rooms ───────────────────────────────────────────────

    [HttpGet("event-types")]
    public IActionResult GetEventTypes() =>
        Ok(HealthcareDataRepository.GetEventTypes());

    [HttpGet("rooms")]
    public IActionResult GetRooms() =>
        Ok(HealthcareDataRepository.GetRoomOptions());

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

    private static ScheduleAppointment MapDto(ScheduleAppointmentDto d)
    {
        var start = d.Start;
        var end   = d.End;

        // Enforce minimum 1-hour duration
        if ((end - start).TotalHours < 1)
            end = start.AddHours(1);

        return new()
        {
            Id          = d.Id,
            Title       = d.Title       ?? "",
            PatientName = d.PatientName ?? d.Title ?? "",
            Reason      = d.Reason      ?? "",
            Room        = d.Room        ?? "",
            EventType   = d.EventType   ?? "",
            Start       = start,
            End         = end,
        };
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────

public record NotesPayload(string? Notes);
public record AddNotePayload(string? Text);
public record StatusPayload(string? Status);
public record DoctorProfilePayload(string? FullName, string? Email, string? Phone);
public record AvatarPayload(string? Avatar);

public class ScheduleAppointmentDto
{
    public int      Id          { get; set; }
    public string?  Title       { get; set; }
    public string?  PatientName { get; set; }
    public string?  Reason      { get; set; }
    public string?  Room        { get; set; }
    public string?  EventType   { get; set; }
    public DateTime Start       { get; set; }
    public DateTime End         { get; set; }
}
