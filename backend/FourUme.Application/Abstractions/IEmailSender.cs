namespace FourUme.Application.Abstractions;

public record EmailMessage(string To, string Subject, string Html, string Text);

public interface IEmailSender
{
    /// <summary>Throws <see cref="InvalidOperationException"/> with a user-facing message when the mail can't be sent.</summary>
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}
