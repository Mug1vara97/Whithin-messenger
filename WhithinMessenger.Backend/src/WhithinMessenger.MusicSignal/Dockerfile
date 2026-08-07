FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8082

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["src/WhithinMessenger.MusicSignal/WhithinMessenger.MusicSignal.csproj", "src/WhithinMessenger.MusicSignal/"]
RUN dotnet restore "src/WhithinMessenger.MusicSignal/WhithinMessenger.MusicSignal.csproj"
COPY ["src/WhithinMessenger.MusicSignal/", "src/WhithinMessenger.MusicSignal/"]
WORKDIR "/src/src/WhithinMessenger.MusicSignal"
RUN dotnet build "./WhithinMessenger.MusicSignal.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./WhithinMessenger.MusicSignal.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENV ASPNETCORE_URLS=http://+:8082
ENTRYPOINT ["dotnet", "WhithinMessenger.MusicSignal.dll"]
