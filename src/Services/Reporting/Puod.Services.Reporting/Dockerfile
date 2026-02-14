FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["src/Services/Reporting/Puod.Services.Reporting.csproj", "src/Services/Reporting/"]
COPY ["src/Shared/Common/Puod.Shared.Common.csproj", "src/Shared/Common/"]
COPY ["src/Shared/Contracts/Puod.Shared.Contracts.csproj", "src/Shared/Contracts/"]
RUN dotnet restore "src/Services/Reporting/Puod.Services.Reporting.csproj"

COPY . .
WORKDIR "/src/src/Services/Reporting"
RUN dotnet publish "Puod.Services.Reporting.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "Puod.Services.Reporting.dll"]
