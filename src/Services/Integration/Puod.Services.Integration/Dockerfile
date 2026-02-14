FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["src/Services/Integration/Puod.Services.Integration/Puod.Services.Integration.csproj", "src/Services/Integration/Puod.Services.Integration/"]
RUN dotnet restore "src/Services/Integration/Puod.Services.Integration/Puod.Services.Integration.csproj"

COPY . .
WORKDIR "/src/src/Services/Integration/Puod.Services.Integration"
RUN dotnet publish "Puod.Services.Integration.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "Puod.Services.Integration.dll"]
