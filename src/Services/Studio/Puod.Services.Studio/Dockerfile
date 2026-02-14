FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY ["src/Services/Studio/Puod.Services.Studio/Puod.Services.Studio.csproj", "src/Services/Studio/Puod.Services.Studio/"]
RUN dotnet restore "src/Services/Studio/Puod.Services.Studio/Puod.Services.Studio.csproj"

COPY . .
WORKDIR "/src/src/Services/Studio/Puod.Services.Studio"
RUN dotnet publish "Puod.Services.Studio.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "Puod.Services.Studio.dll"]
