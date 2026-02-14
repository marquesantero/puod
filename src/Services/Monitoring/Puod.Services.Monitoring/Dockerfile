FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY ["src/Services/Monitoring/Puod.Services.Monitoring.csproj", "src/Services/Monitoring/"]
RUN dotnet restore "src/Services/Monitoring/Puod.Services.Monitoring.csproj"

COPY . .
WORKDIR "/src/src/Services/Monitoring"
RUN dotnet publish "Puod.Services.Monitoring.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "Puod.Services.Monitoring.dll"]
