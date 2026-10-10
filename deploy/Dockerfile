FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
# Publishing for one runtime keeps only that platform's native libraries (SkiaSharp ships ~450 MB for all).
ARG TARGETARCH
WORKDIR /src
COPY backend/FourUme.sln ./
COPY backend/FourUme.Domain ./FourUme.Domain
COPY backend/FourUme.Application ./FourUme.Application
COPY backend/FourUme.Infrastructure ./FourUme.Infrastructure
COPY backend/FourUme.Api ./FourUme.Api
RUN RID=linux-$([ "$TARGETARCH" = "arm64" ] && echo arm64 || echo x64) \
    && dotnet restore FourUme.Api/FourUme.Api.csproj -r $RID \
    && dotnet publish FourUme.Api/FourUme.Api.csproj -c Release -r $RID --self-contained false --no-restore \
       -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
# ffmpeg converts phone recordings (m4a/webm/wav) for Azure pronunciation assessment.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish .
COPY backend/data/vocabulary.json /app/data/vocabulary.json
COPY backend/data/grammar /app/data/grammar
COPY backend/data/listening /app/data/listening
ENV ASPNETCORE_URLS=http://+:5088
ENV Vocabulary__Path=/app/data/vocabulary.json
ENV Grammar__Path=/app/data/grammar
ENV Listening__Path=/app/data/listening
EXPOSE 5088
ENTRYPOINT ["dotnet", "FourUme.Api.dll"]
