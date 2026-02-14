using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Puod.Services.Integration.Connectors;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddSingleton<DatabricksConnector>();
builder.Services.AddSingleton<DataConnectorFactory>();
builder.Services.AddSingleton<IEnumerable<IDataConnector>>(sp => new IDataConnector[]
{
    sp.GetRequiredService<DatabricksConnector>()
});

// Reuse gateway JWT settings; adjust via appsettings if needed
var jwtSection = builder.Configuration.GetSection("JwtSettings");
var secret = jwtSection["Secret"] ?? "your-256-bit-secret-key-change-in-production-min-32-chars-please";
var issuer = jwtSection["Issuer"] ?? "https://puod.local";
var audience = jwtSection["Audience"] ?? "puod-api";
var key = Encoding.UTF8.GetBytes(secret);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = issuer,
        ValidateAudience = true,
        ValidAudience = audience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/health", () => new
{
    status = "healthy",
    service = "integration",
    timestamp = DateTime.UtcNow
});

app.Run();
