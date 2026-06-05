namespace WhithinMessenger.Domain.Interfaces;

public static class MessageStatusHelper
{
    public const string Sent = "sent";
    public const string Delivered = "delivered";
    public const string Read = "read";

    public static string Resolve(int recipientCount, int deliveredCount, int readCount)
    {
        if (recipientCount <= 0)
        {
            return Sent;
        }

        if (readCount >= recipientCount)
        {
            return Read;
        }

        if (deliveredCount >= recipientCount)
        {
            return Delivered;
        }

        return Sent;
    }
}
