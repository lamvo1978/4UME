FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY backend/FourUme.sln ./
COPY backend/FourUme.Domain ./FourUme.Domain
COPY backend/FourUme.Application ./FourUme.Application
COPY backend/FourUme.Infrastructure ./FourUme.Infrastructure
COPY backend/FourUme.Api ./FourUme.Api
RUN dotnet restore FourUme.Api/FourUme.Api.csproj
RUN dotnet publish FourUme.Api/FourUme.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
COPY backend/data/vocabulary.json /app/data/vocabulary.json
COPY backend/data/grammar /app/data/grammar
ENV ASPNETCORE_URLS=http://+:5088
ENV Vocabulary__Path=/app/data/vocabulary.json
ENV Grammar__Path=/app/data/grammar
EXPOSE 5088
ENTRYPOINT ["dotnet", "FourUme.Api.dll"]
