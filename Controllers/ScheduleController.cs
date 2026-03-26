using Microsoft.AspNetCore.Mvc;

namespace HealthcareApp.Controllers;

public class ScheduleController : Controller
{
    public IActionResult Index()
    {
        ViewData["Title"]      = "Schedule — Dr. Carter";
        ViewData["ActivePage"] = "Schedule";
        return View();
    }
}
