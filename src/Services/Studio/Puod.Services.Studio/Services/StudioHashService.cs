using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Puod.Services.Studio.Services;

public static class StudioHashService
{
    public static string ComputeSignature(object payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            WriteIndented = false
        });

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(hash);
    }
}
