using Microsoft.AspNetCore.Mvc;

namespace HealthcareApp.Controllers;

public class WorkspaceController : Controller
{
    [HttpGet("/labs")]
    public IActionResult Labs() => Workspace("Labs", "Lab & Diagnostics");

    [HttpGet("/messages")]
    public IActionResult Messages() => Workspace("Messages", "Secure Messages");

    [HttpGet("/providers")]
    public IActionResult Providers() => Workspace("Providers", "Provider Directory");

    [HttpGet("/settings")]
    public IActionResult Settings() => Workspace("Settings", "Settings & Preferences");

    [HttpGet("/notifications")]
    public IActionResult Notifications() => Workspace("Notifications", "Notifications");

    [HttpGet("/help")]
    public IActionResult Help() => Workspace("Help", "Help & Support");

    [HttpGet("/intake")]
    public IActionResult Intake() => Workspace("Intake", "New Patient Intake");

    [HttpGet("/login")]
    public IActionResult Login() => Workspace("Login", "Sign in to CarePoint");

    [HttpGet("/not-found")]
    public IActionResult NotFoundPage() => Workspace("NotFound", "Page not found");

    private IActionResult Workspace(string page, string title)
    {
        ViewData["ActivePage"] = page;
        ViewData["Title"] = $"{title} — Dr. Carter";
        ViewData["WorkspaceTitle"] = title;
        return View("Index");
    }
}
