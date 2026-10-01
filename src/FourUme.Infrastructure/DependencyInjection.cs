using FourUme.Application.Abstractions;
using FourUme.Application.Auth;
using FourUme.Application.Grammar;
using FourUme.Application.Vocabulary;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Auth;
using FourUme.Infrastructure.Grammar;
using FourUme.Infrastructure.Persistence;
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
        services.AddScoped<IVocabularyService, VocabularyService>();
        services.AddScoped<IGrammarService, GrammarService>();
        return services;
    }
}
