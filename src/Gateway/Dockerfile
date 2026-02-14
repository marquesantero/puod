FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["src/Gateway/Puod.Gateway.csproj", "src/Gateway/"]
RUN dotnet restore "src/Gateway/Puod.Gateway.csproj"

COPY . .
WORKDIR "/src/src/Gateway"
RUN dotnet publish "Puod.Gateway.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "Puod.Gateway.dll"]
