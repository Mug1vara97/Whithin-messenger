namespace WhithinMessenger.Domain.Utils;

public static class AvatarColorGenerator
{
    private static readonly string[] Colors = 
    {
        "#5865F2", // Discord Blue
        "#EB459E", // Discord Pink
        "#ED4245", // Discord Red
        "#FEE75C", // Discord Yellow
        "#57F287", // Discord Green
        "#FAA61A", // Discord Orange
        "#9C84EF", // Discord Purple
        "#F47B68", // Discord Coral
        "#43B581", // Discord Teal
        "#747F8D"  // Discord Gray
    };

    /// <summary>
    /// Генерирует случайный цвет аватара на основе ID пользователя
    /// </summary>
    /// <param name="userId">ID пользователя</param>
    /// <returns>Hex-код цвета</returns>
    public static string GenerateColor(Guid userId)
    {
        int index = Math.Abs(userId.GetHashCode()) % Colors.Length;
        return Colors[index];
    }

    /// <summary>
    /// Генерирует случайный цвет аватара
    /// </summary>
    /// <returns>Hex-код цвета</returns>
    public static string GenerateRandomColor()
    {
        var random = new Random();
        int index = random.Next(Colors.Length);
        return Colors[index];
    }
}
