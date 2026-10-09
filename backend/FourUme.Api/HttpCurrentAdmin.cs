using FourUme.Application.Admin;

namespace FourUme.Api;

/// <summary>Reads the admin identity that the /api/admin endpoint filter stored on the request.</summary>
public sealed class HttpCurrentAdmin(IHttpContextAccessor accessor) : ICurrentAdmin
{
    private AdminIdentityDto? Identity => accessor.HttpContext?.Items[AdminEndpoints.AdminKey] as AdminIdentityDto;

    public Guid? Id => Identity?.Id;
    public string Name => Identity is { } a ? (string.IsNullOrWhiteSpace(a.DisplayName) ? a.Email : a.DisplayName) : "Hệ thống";
}
