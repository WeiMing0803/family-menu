namespace FamilyMenu.Api.Services;

public sealed record ServiceResult<T>(bool Success, T? Value, int StatusCode, string? Error)
{
    public static ServiceResult<T> Ok(T value) => new(true, value, StatusCodes.Status200OK, null);

    public static ServiceResult<T> Created(T value) => new(true, value, StatusCodes.Status201Created, null);

    public static ServiceResult<T> Fail(int statusCode, string error) => new(false, default, statusCode, error);
}
