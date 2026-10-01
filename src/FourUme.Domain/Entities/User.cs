namespace FourUme.Domain.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<WordProgress> WordProgresses { get; set; } = new List<WordProgress>();
    public ICollection<GrammarAttempt> GrammarAttempts { get; set; } = new List<GrammarAttempt>();
}
