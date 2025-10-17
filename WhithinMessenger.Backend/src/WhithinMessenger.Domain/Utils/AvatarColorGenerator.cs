namespace WhithinMessenger.Domain.Utils;

public static class AvatarColorGenerator
{
    private static readonly string[] Colors = 
    {
        "#5865F2", 
        "#EB459E", 
        "#ED4245", 
        "#FEE75C", 
        "#57F287", 
        "#FAA61A", 
        "#9C84EF", 
        "#F47B68", 
        "#43B581", 
        "#747F8D" 
    };

    public static string GenerateColor(Guid userId)
    {
        int index = Math.Abs(userId.GetHashCode()) % Colors.Length;
        return Colors[index];
    }

    public static string GenerateRandomColor()
    {
        var random = new Random();
        int index = random.Next(Colors.Length);
        return Colors[index];
    }
}
