using Microsoft.AspNetCore.Mvc;

namespace HealthcareApp.Controllers;

public class PatientsController : Controller
{
    public IActionResult Index()
    {
        ViewData["Title"]      = "Patients — Dr. Carter";
        ViewData["ActivePage"] = "Patients";
        return View();
    }
}
