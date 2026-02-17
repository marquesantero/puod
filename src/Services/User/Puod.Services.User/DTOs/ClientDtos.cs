using System.ComponentModel.DataAnnotations;
using Puod.Services.User.Models;

namespace Puod.Services.User.DTOs;

/// <summary>
/// Response for client list view
/// </summary>
public record ClientListResponse(
    long Id,
    string Name,
    string Slug,
    SubscriptionTier Tier,
    bool IsAlterable,
    bool IsActive,
    int CompanyCount,
    DateTime CreatedAt,
    string? LogoUrl,
    string? Country,
    string? Industry,
    List<ClientCompanyInfo>? Companies = null);

/// <summary>
/// Response for client detail view with companies
/// </summary>
public record ClientDetailResponse(
    long Id,
    string Name,
    string Slug,
    SubscriptionTier Tier,
    bool IsAlterable,
    bool IsActive,
    string? LogoUrl,
    string? TaxId,
    string? Website,
    string? Email,
    string? Phone,
    string? Address,
    string? City,
    string? State,
    string? Country,
    string? PostalCode,
    string? Description,
    string? Industry,
    int? EmployeeCount,
    DateTime? FoundedDate,
    List<ClientCompanyInfo> Companies,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

/// <summary>
/// Company info for client detail
/// </summary>
public record ClientCompanyInfo(
    long Id,
    string Name,
    string Slug,
    bool IsActive,
    DateTime CreatedAt);

/// <summary>
/// Request to create a new client
/// </summary>
public record ClientCreateRequest(
    [Required] string Name,
    SubscriptionTier Tier = SubscriptionTier.Free,
    bool IsAlterable = true,
    string? LogoUrl = null,
    string? TaxId = null,
    string? Website = null,
    string? Email = null,
    string? Phone = null,
    string? Address = null,
    string? City = null,
    string? State = null,
    string? Country = null,
    string? PostalCode = null,
    string? Description = null,
    string? Industry = null,
    int? EmployeeCount = null,
    DateTime? FoundedDate = null);

/// <summary>
/// Request to update an existing client
/// Note: IsAlterable cannot be changed after creation
/// </summary>
public record ClientUpdateRequest(
    [Required] string Name,
    SubscriptionTier Tier,
    bool IsActive,
    string? LogoUrl = null,
    string? TaxId = null,
    string? Website = null,
    string? Email = null,
    string? Phone = null,
    string? Address = null,
    string? City = null,
    string? State = null,
    string? Country = null,
    string? PostalCode = null,
    string? Description = null,
    string? Industry = null,
    int? EmployeeCount = null,
    DateTime? FoundedDate = null);

/// <summary>
/// Preview of client information for company creation
/// Shows what info will be inherited if InheritFromClient is enabled
/// </summary>
public record ClientInfoPreview(
    long Id,
    string Name,
    SubscriptionTier Tier,
    string? LogoUrl,
    string? TaxId,
    string? Website,
    string? Email,
    string? Phone,
    string? Address,
    string? City,
    string? State,
    string? Country,
    string? PostalCode,
    string? Description,
    string? Industry,
    int? EmployeeCount,
    DateTime? FoundedDate);
