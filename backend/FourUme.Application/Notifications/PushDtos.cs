namespace FourUme.Application.Notifications;

/// <summary>Kinds of server pushes, as stored in <c>NotificationLogs.Kind</c>.</summary>
public static class PushKinds
{
    public const string Weekly = "weekly";
    public const string Comeback = "comeback";
    public const string Feedback = "feedback";
    public const string Test = "test";
}

/// <summary>Keys in <see cref="PushMessage.Data"/> the app sends back when the notification is tapped.</summary>
public static class PushData
{
    public const string LogId = "logId";
    public const string BroadcastId = "broadcastId";
}

/// <param name="Data">Read by the app when the notification is tapped: <c>screen</c> plus its parameters.</param>
public record PushMessage(string Title, string Body, IReadOnlyDictionary<string, string> Data);

/// <param name="Devices">Devices the user has registered.</param>
/// <param name="Sent">Devices Expo accepted the message for.</param>
public record PushResult(int Devices, int Sent, IReadOnlyList<string> Errors);

public interface IPushNotifier
{
    /// <summary>Admin check that pushes reach the user's phones; ignores quiet hours and switches.</summary>
    Task<PushResult> SendTestAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Sends straight to every phone of the user, ignoring quiet hours and switches.</summary>
    Task<PushResult> SendToUserAsync(Guid userId, PushMessage message, CancellationToken ct = default);

    /// <summary>Tells the learner an admin answered; skipped during their quiet hours. Never throws.</summary>
    Task FeedbackReplyAsync(Guid userId, Guid ticketId, string subject, string reply, CancellationToken ct = default);

    /// <summary>Records the first tap on a server push or a broadcast of this user; unknown ids are ignored.</summary>
    Task MarkOpenedAsync(Guid userId, Guid? logId, Guid? broadcastId, CancellationToken ct = default);
}

/// <param name="LogId">From a scheduled push (weekly, comeback).</param>
/// <param name="BroadcastId">From an admin broadcast.</param>
public record NotificationOpenedRequest(Guid? LogId, Guid? BroadcastId);
