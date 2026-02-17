using System.Security.Claims;
using Puod.Services.User.DTOs;
using Puod.Services.User.Models;

namespace Puod.Services.User.Services;

public interface IJwtTokenService
{
    string GenerateAccessToken(Models.User user, IEnumerable<string>? permissions = null);
    RefreshToken GenerateRefreshToken(long userId);
    ClaimsPrincipal? ValidateToken(string token);
}
