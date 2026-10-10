using FourUme.Application.About;
using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using FourUme.Infrastructure.About;
using FourUme.Application.Admin;
using FourUme.Infrastructure.Admin;
using FourUme.Infrastructure.Media;
using FourUme.Infrastructure.Activity;
using FourUme.Application.Auth;
using FourUme.Application.Grammar;
using FourUme.Application.Notifications;
using FourUme.Application.Placement;
using FourUme.Application.Pronunciation;
using FourUme.Infrastructure.Pronunciation;
using FourUme.Infrastructure.Notifications;
using FourUme.Infrastructure.Placement;
using FourUme.Application.Review;
using FourUme.Application.Vocabulary;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Auth;
using FourUme.Infrastructure.Email;
using FourUme.Infrastructure.Grammar;
using FourUme.Infrastructure.Listening;
using FourUme.Application.Listening;
using FourUme.Infrastructure.Persistence;
using FourUme.Infrastructure.Review;
using FourUme.Infrastructure.Vocabulary;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FourUme.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));

        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is missing.");

        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        services.AddSingleton<PasswordHasher<User>>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<EmailCodeService>();
        services.Configure<EmailOptions>(configuration.GetSection(EmailOptions.SectionName));
        services.AddHttpClient<IEmailSender, ResendEmailSender>(c => c.Timeout = TimeSpan.FromSeconds(15));
        services.AddScoped<IVocabularyService, VocabularyService>();
        services.AddScoped<IPlacementService, PlacementService>();
        services.AddScoped<IGrammarService, GrammarService>();
        services.AddScoped<IReviewService, ReviewService>();
        services.AddScoped<IActivityService, ActivityService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IAdminService, AdminService>();
        services.AddScoped<IAdminContentService, AdminContentService>();
        services.AddScoped<IAdminGrammarService, AdminGrammarService>();
        services.AddScoped<IListeningService, ListeningService>();
        services.AddScoped<IAdminListeningService, AdminListeningService>();
        services.Configure<SpeechOptions>(configuration.GetSection(SpeechOptions.SectionName));
        services.AddHttpClient(AzureSpeechClient.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(30));
        services.AddSingleton<AzureSpeechClient>();
        services.AddSingleton<ListeningAudioJobs>();
        services.AddSingleton<AzurePronunciationClient>();
        services.AddScoped<IPronunciationService, PronunciationService>();
        services.AddScoped<IAboutService, AboutService>();
        services.Configure<GeminiOptions>(configuration.GetSection(GeminiOptions.SectionName));
        services.AddHttpClient(GeminiDraftService.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(90));
        services.AddScoped<IListeningDraftService, GeminiDraftService>();
        services.AddScoped<IAdminAuditService, AdminAuditService>();
        services.AddScoped<IAdminUserService, AdminUserService>();
        services.AddScoped<IAdminSettingsService, AdminSettingsService>();
        services.AddScoped<Auditor>();
        services.AddSingleton<IUserAccess, UserAccess>();
        services.Configure<MediaOptions>(configuration.GetSection(MediaOptions.SectionName));
        services.Configure<StockImageOptions>(configuration.GetSection(StockImageOptions.SectionName));
        services.AddMemoryCache();
        services.AddHttpClient<StockImageClient>(c =>
        {
            c.Timeout = TimeSpan.FromSeconds(20);
            c.DefaultRequestHeaders.UserAgent.ParseAdd("4UME/1.0 (+https://admin.4ume.io.vn)");
        });
        services.AddScoped<IWordImageService, WordImageService>();
        return services;
    }
}
