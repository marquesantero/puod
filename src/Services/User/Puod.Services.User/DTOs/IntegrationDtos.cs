using System.ComponentModel.DataAnnotations;
using Puod.Services.User.Models;

namespace Puod.Services.User.DTOs;

public record CompanySummaryResponse(long Id, string Name, string Slug);

public record IntegrationGroupResponse(
    long Id,
    long CompanyId,
    string Name,
    string? Description,
    DateTime CreatedAt);

public record IntegrationResponse(
    long Id,
    long CompanyId,
    bool IsInherited,
    string Type,
    string Name,
    string? Description,
    string Status,
    string ConfigJson,
    DateTime CreatedAt);

public record IntegrationOverviewResponse(
    List<IntegrationGroupResponse> Groups,
    List<IntegrationResponse> Integrations);

public record IntegrationGroupCreateRequest(
    [Required] long CompanyId,
    [Required] string Name,
    string? Description);

public record IntegrationGroupUpdateRequest(
    [Required] string Name,
    string? Description);

public record IntegrationCreateRequest(
    [Required] long CompanyId,
    long? GroupId,
    [Required] string Type,
    [Required] string Name,
    string? Description,
    string ConfigJson,
    string? Status);

public record IntegrationUpdateRequest(
    [Required] string Name,
    string? Description,
    string ConfigJson,
    string? Status);

public record IntegrationTestResponse(
    bool Success,
    string Message,
    string Status);
