# Stage 1: Restore + build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Effinsty.Api.sln ./
COPY src/Effinsty.Domain/Effinsty.Domain.fsproj src/Effinsty.Domain/
COPY src/Effinsty.Application/Effinsty.Application.fsproj src/Effinsty.Application/
COPY src/Effinsty.Infrastructure/Effinsty.Infrastructure.fsproj src/Effinsty.Infrastructure/
COPY src/Effinsty.Api/Effinsty.Api.fsproj src/Effinsty.Api/
COPY tests/Effinsty.UnitTests/Effinsty.UnitTests.fsproj tests/Effinsty.UnitTests/
COPY tests/Effinsty.IntegrationTests/Effinsty.IntegrationTests.fsproj tests/Effinsty.IntegrationTests/

RUN dotnet restore Effinsty.Api.sln

COPY . .
RUN dotnet publish src/Effinsty.Api/Effinsty.Api.fsproj -c Release -o /app/publish

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

RUN mkdir -p /oracle/wallet

COPY --from=build /app/publish .

RUN adduser --disabled-password --gecos "" appuser
USER appuser

ENV ASPNETCORE_URLS=http://+:8080
ENV TNS_ADMIN=/oracle/wallet
ENV ORACLE_WALLET_LOCATION=/oracle/wallet

EXPOSE 8080
ENTRYPOINT ["dotnet", "Effinsty.Api.dll"]
