export async function moderateVoiceParticipant({
  connection,
  serverId,
  channelId,
  targetUserId,
  muteMic,
  deafen,
}) {
  if (!connection || connection.state !== 'Connected') {
    throw new Error('Нет подключения к серверу');
  }

  await connection.invoke(
    'ModerateVoiceMember',
    serverId,
    channelId,
    targetUserId,
    muteMic ?? null,
    deafen ?? null
  );
}
