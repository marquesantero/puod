namespace Puod.Services.User.Data;

public interface ICurrentUserProvider
{
    long? UserId { get; }
}
