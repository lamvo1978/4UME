FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY FourUme.sln ./
COPY src/FourUme.Domain ./src/FourUme.Domain
COPY src/FourUme.Application ./src/FourUme.Application
COPY src/FourUme.Infrastructure ./src/FourUme.Infrastructure
COPY src/FourUme.Api ./src/FourUme.Api
RUN dotnet restore src/FourUme.Api/FourUme.Api.csproj
RUN dotnet publish src/FourUme.Api/FourUme.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
COPY data/vocabulary.json /app/data/vocabulary.json
ENV ASPNETCORE_URLS=http://+:5088
ENV Vocabulary__Path=/app/data/vocabulary.json
EXPOSE 5088
ENTRYPOINT ["dotnet", "FourUme.Api.dll"]
