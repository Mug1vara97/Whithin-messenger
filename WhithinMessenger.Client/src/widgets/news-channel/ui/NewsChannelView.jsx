import React from 'react';
import FeedPanel from '../../feed-panel/ui/FeedPanel';

const NewsChannelView = ({
  serverId,
  channelName = 'Новости',
  canCreate = true,
}) => {
  if (!serverId) {
    return (
      <div className="feed-panel feed-panel--embedded">
        <div className="feed-panel__empty">Сервер не выбран</div>
      </div>
    );
  }

  return (
    <FeedPanel
      serverId={serverId}
      channelName={channelName}
      canCreate={canCreate}
      embedded
    />
  );
};

export default NewsChannelView;
