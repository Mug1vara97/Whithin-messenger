FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["src/WhithinMessenger.Api/WhithinMessenger.Api.csproj", "src/WhithinMessenger.Api/"]
COPY ["src/WhithinMessenger.Application/WhithinMessenger.Application.csproj", "src/WhithinMessenger.Application/"]
COPY ["src/WhithinMessenger.Domain/WhithinMessenger.Domain.csproj", "src/WhithinMessenger.Domain/"]
COPY ["src/WhithinMessenger.Infrastructure/WhithinMessenger.Infrastructure.csproj", "src/WhithinMessenger.Infrastructure/"]
RUN dotnet restore "src/WhithinMessenger.Api/WhithinMessenger.Api.csproj"
COPY . .
WORKDIR "/src/src/WhithinMessenger.Api"
RUN dotnet build "./WhithinMessenger.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./WhithinMessenger.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false /p:CopyRefAssembliesToPublishDirectory=true

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "WhithinMessenger.Api.dll"]
