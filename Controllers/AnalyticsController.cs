using Microsoft.AspNetCore.Mvc;

namespace HealthcareApp.Controllers;

public class AnalyticsController : Controller
{
    public IActionResult Index()
    {
        ViewData["Title"]      = "Clinical Analytics — Dr. Carter";
        ViewData["ActivePage"] = "Analytics";
        return View();
    }
}
