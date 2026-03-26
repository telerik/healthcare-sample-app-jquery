using System.Diagnostics;
using HealthcareApp.Models;
using Microsoft.AspNetCore.Mvc;

namespace HealthcareApp.Controllers;

public class HomeController : Controller
{
    public IActionResult Index()
    {
        ViewData["Title"]      = "Doctor Workspace — Dr. Carter";
        ViewData["ActivePage"] = "Home";
        return View();
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
