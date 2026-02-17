FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy all dependent .csproj files for proper restore caching
COPY ["src/Services/User/Puod.Services.User/Puod.Services.User.csproj", "src/Services/User/Puod.Services.User/"]
COPY ["src/Services/User/Puod.Services.User.Data/Puod.Services.User.Data.csproj", "src/Services/User/Puod.Services.User.Data/"]
COPY ["src/Services/User/Puod.Services.User.Migrations.Postgres/Puod.Services.User.Migrations.Postgres.csproj", "src/Services/User/Puod.Services.User.Migrations.Postgres/"]
COPY ["src/Services/User/Puod.Services.User.Migrations.SqlServer/Puod.Services.User.Migrations.SqlServer.csproj", "src/Services/User/Puod.Services.User.Migrations.SqlServer/"]
COPY ["src/Services/User/Puod.Services.User.Migrations.MySql/Puod.Services.User.Migrations.MySql.csproj", "src/Services/User/Puod.Services.User.Migrations.MySql/"]
RUN dotnet restore "src/Services/User/Puod.Services.User/Puod.Services.User.csproj"

COPY . .
WORKDIR "/src/src/Services/User/Puod.Services.User"
RUN dotnet publish "Puod.Services.User.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "Puod.Services.User.dll"]
