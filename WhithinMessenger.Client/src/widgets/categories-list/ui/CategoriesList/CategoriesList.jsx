import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { CategoryItem, ChannelItem } from '../../../../shared/ui/molecules';
import { reorderCategories, moveChatBetweenCategories } from '../../../../shared/lib/dnd';
import voiceChannelService from '../../../../shared/lib/services/voiceChannelService';
import { voiceCallApi } from '../../../../entities/voice-call/api/voiceCallApi';
import './CategoriesList.css';

const VOICE_TYPE_GUID = "44444444-4444-4444-4444-444444444444";
const isVoiceChannelChat = (chat) => {
  const t = chat?.chatType ?? chat?.ChatType;
  const typeId = chat?.typeId ?? chat?.TypeId;
  return (
    t === 4 || t === '4' ||
    typeId === 4 || typeId === '4' ||
    typeId === VOICE_TYPE_GUID
  );
};

const CategoriesList = ({ 
  categories = [],
  selectedChat,
  onChatClick,
  onAddChannel,
  onChannelContextMenu,
  onCategoryContextMenu,
  onChannelSettings,
  onEmptySpaceContextMenu,
  connection,
  serverId,
  userId,
  userName,
  onCategoriesReordered,
  onChatsReordered,
  onServerDataUpdated
}) => {
  const [localCategories, setLocalCategories] = useState(categories);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  // Подключаемся к voice-server для получения участников голосовых каналов
  const voiceServiceConnectedRef = useRef(false);
  const subscribedChannelsRef = useRef(new Set());
  
  // Подключаемся к voice-server при монтировании
  useEffect(() => {
    if (!voiceServiceConnectedRef.current) {
      voiceChannelService.connect();
      voiceServiceConnectedRef.current = true;
    }
    
    return () => {
      // При размонтировании отписываемся от всех каналов
      subscribedChannelsRef.current.forEach(channelId => {
        voiceChannelService.unsubscribeFromChannel(channelId);
      });
      subscribedChannelsRef.current.clear();
    };
  }, []);
  
  // Подписываемся на голосовые каналы при изменении категорий
  useEffect(() => {
    if (!localCategories || localCategories.length === 0) return;
    
    // Собираем все голосовые каналы
    const voiceChannelIds = new Set();
    localCategories.forEach(category => {
      const chats = category.chats || category.Chats || [];
      chats.forEach(chat => {
        const isVoice = isVoiceChannelChat(chat);
        if (isVoice) {
          const channelId = chat.chatId || chat.ChatId;
          if (channelId) {
            voiceChannelIds.add(channelId);
          }
        }
      });
    });
    
    // Подписываемся на новые каналы
    voiceChannelIds.forEach(channelId => {
      if (!subscribedChannelsRef.current.has(channelId)) {
        voiceChannelService.subscribeToChannel(channelId);
        subscribedChannelsRef.current.add(channelId);
      }
    });
    
    // Отписываемся от каналов которые больше не существуют
    subscribedChannelsRef.current.forEach(channelId => {
      if (!voiceChannelIds.has(channelId)) {
        voiceChannelService.unsubscribeFromChannel(channelId);
        subscribedChannelsRef.current.delete(channelId);
      }
    });
  }, [localCategories]);

  useEffect(() => {
    console.log('CategoriesList: Connection received:', connection, 'State:', connection?.state);
    if (!connection || connection.state !== 'Connected') return;

    const handleCategoriesReordered = (updatedCategories) => {
      console.log('CategoriesReordered received:', updatedCategories);
      setLocalCategories(updatedCategories);
      
      if (onCategoriesReordered) {
        onCategoriesReordered(updatedCategories);
      }
    };

    const handleChatsReordered = (updatedCategories) => {
      console.log('ChatsReordered received:', updatedCategories);
      setLocalCategories(updatedCategories);
      
      if (onChatsReordered) {
        onChatsReordered(updatedCategories);
      }
    };

    const handleChatCreated = (newChat, categoryId) => {
      console.log('CategoriesList: ChatCreated event received:', { newChat, categoryId });
      
      const updatedCategories = localCategories.map(cat => {
        if ((cat.categoryId || cat.CategoryId) === categoryId) {
          return {
            ...cat,
            chats: [...(cat.chats || cat.Chats || []), newChat]
          };
        }
        return cat;
      });
      
      setLocalCategories(updatedCategories);
      
      // Вызываем onServerDataUpdated для передачи данных в HomePage
      if (onServerDataUpdated) {
        console.log('CategoriesList: Calling onServerDataUpdated with updated categories');
        onServerDataUpdated({ categories: updatedCategories });
      }
    };

    const handleChatDeleted = (chatId) => {
      setLocalCategories(prev => prev.map(cat => ({
        ...cat,
        chats: (cat.chats || cat.Chats || []).filter(chat => 
          (chat.chatId || chat.ChatId) !== chatId
        )
      })));
    };

    const handleCategoryCreated = (newCategory) => {
      setLocalCategories(prev => [...prev, newCategory]);
    };

    const handleCategoryDeleted = (categoryId) => {
      setLocalCategories(prev => prev.filter(cat => 
        (cat.categoryId || cat.CategoryId) !== categoryId
      ));
    };

    connection.on("CategoriesReordered", handleCategoriesReordered);
    connection.on("ChatsReordered", handleChatsReordered);
    connection.on("ChatCreated", handleChatCreated);
    connection.on("ChatDeleted", handleChatDeleted);
    connection.on("CategoryCreated", handleCategoryCreated);
    connection.on("CategoryDeleted", handleCategoryDeleted);

    return () => {
      connection.off("CategoriesReordered", handleCategoriesReordered);
      connection.off("ChatsReordered", handleChatsReordered);
      connection.off("ChatCreated", handleChatCreated);
      connection.off("ChatDeleted", handleChatDeleted);
      connection.off("CategoryCreated", handleCategoryCreated);
      connection.off("CategoryDeleted", handleCategoryDeleted);
    };
  }, [connection?.state, onCategoriesReordered, onChatsReordered]);

  const handleChatClick = (channel) => {
    if (onChatClick) {
      onChatClick(channel.chatId || channel.ChatId, channel.name || channel.Name || channel.groupName, channel.chatType || channel.typeId);
    }
  };

  const handleAddChannel = (categoryId) => {
    if (onAddChannel) {
      onAddChannel(categoryId);
    }
  };

  const handleChannelContextMenu = (e, channel, category) => {
    if (onChannelContextMenu) {
      onChannelContextMenu(e, channel, category);
    }
  };

  const handleChannelSettings = (channel) => {
    if (onChannelSettings) {
      onChannelSettings(channel);
    }
  };

  const handleCategoryContextMenu = (e, category) => {
    if (onCategoryContextMenu) {
      onCategoryContextMenu(e, category);
    }
  };

  const isChannelActive = (channel) => {
    return selectedChat?.chat_id === (channel.chatId || channel.ChatId);
  };

  const handleDragEnd = useCallback(async (result) => {
    console.log('handleDragEnd called:', result);
    
    if (!result.destination || !connection || connection.state !== 'Connected') {
      console.log('No destination or connection, returning. Connection state:', connection?.state);
      return;
    }

    if (result.reason !== 'DROP') {
      console.log('Not a drop operation, ignoring');
      return;
    }

    const { source, destination, type } = result;
    console.log('Drag operation:', { source, destination, type });

    try {
      if (type === 'CATEGORY') {
        console.log('Moving category');
        
        const regularCategories = localCategories.filter(cat => {
          const id = cat.categoryId || cat.CategoryId;
          return id !== null && id !== undefined;
        });

        console.log('Checking indices:', {
          sourceIndex: source.index,
          destinationIndex: destination.index,
          regularCategoriesLength: regularCategories.length
        });
        
        if (source.index >= regularCategories.length || destination.index >= regularCategories.length) {
          console.log('Invalid indices, returning');
          return;
        }

        console.log('Regular categories:', regularCategories.map(cat => ({ id: cat.categoryId || cat.CategoryId, name: cat.categoryName || cat.CategoryName })));
        console.log('Source index:', source.index, 'Destination index:', destination.index);
        console.log('Regular categories length:', regularCategories.length);
        console.log('All localCategories:', localCategories.map(cat => ({ 
          id: cat.categoryId || cat.CategoryId, 
          name: cat.categoryName || cat.CategoryName,
          isNull: (cat.categoryId || cat.CategoryId) === null || (cat.categoryId || cat.CategoryId) === undefined
        })));

        const newCategories = reorderCategories(
          regularCategories,
          source.index,
          destination.index
        );

        const nullCategories = localCategories.filter(cat => {
          const id = cat.categoryId || cat.CategoryId;
          return id === null || id === undefined;
        });

        const finalCategories = [...nullCategories, ...newCategories];

        console.log('Setting local categories for category move:', finalCategories);
        setLocalCategories(finalCategories);

        const movedCategory = regularCategories[source.index];
        console.log('Invoking MoveCategory with:', { 
          serverId, 
          categoryId: movedCategory.categoryId || movedCategory.CategoryId, 
          newPosition: destination.index 
        });
        
        await connection.invoke("MoveCategory", 
          serverId,
          movedCategory.categoryId || movedCategory.CategoryId,
          destination.index
        );
        
        console.log('MoveCategory completed successfully');
      }
      else if (type === 'CHAT') {
        console.log('Moving chat');
        
        const sourceId = source.droppableId === 'category-null' ? null : 
          source.droppableId.replace('category-', '');
        const targetId = destination.droppableId === 'category-null' ? null :
          destination.droppableId.replace('category-', '');

        const updatedCategories = moveChatBetweenCategories(
          localCategories,
          source,
          destination
        );

        console.log('Setting local categories for chat move:', updatedCategories);
        setLocalCategories(updatedCategories);

        const chatId = result.draggableId.replace('chat-', '');
        console.log('Invoking MoveChat with:', { 
          serverId, 
          chatId, 
          sourceId, 
          targetId, 
          newPosition: destination.index 
        });
        
        await connection.invoke("MoveChat",
          serverId,
          chatId,
          sourceId === 'null' || sourceId === 'undefined' ? null : sourceId,
          targetId === 'null' || targetId === 'undefined' ? null : targetId,
          destination.index
        );
        
        console.log('MoveChat completed successfully');
      }
      else if (type === 'VOICE_PARTICIPANT') {
        console.log('Moving voice participant');
        
        // Извлекаем userId и sourceChannelId из draggableId
        // Формат: voice-participant__{userId}__from__{sourceChannelId}
        const prefix = 'voice-participant__';
        const mid = '__from__';
        if (!result.draggableId.startsWith(prefix) || !result.draggableId.includes(mid)) {
          console.error('Invalid participant draggableId format:', result.draggableId);
          return;
        }

        const withoutPrefix = result.draggableId.slice(prefix.length);
        const [userId, sourceChannelId] = withoutPrefix.split(mid);
        if (!userId || !sourceChannelId) {
          console.error('Invalid participant draggableId parts:', { userId, sourceChannelId, draggableId: result.draggableId });
          return;
        }

        const targetChannelId = destination.droppableId.replace('voice-channel-', '');
        
        // Если перетаскиваем в тот же канал, ничего не делаем
        if (sourceChannelId === targetChannelId) {
          console.log('Participant already in target channel');
          return;
        }
        
        console.log('Moving participant:', { userId, sourceChannelId, targetChannelId });
        
        // Вызываем API для переключения пользователя в другой канал
        try {
          await voiceCallApi.switchUserToChannel(userId, targetChannelId);
          console.log('Participant moved successfully');
        } catch (error) {
          console.error('Failed to move participant:', error);
          alert(`Ошибка переключения пользователя: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('Move operation failed:', error);
      alert(`Ошибка перемещения: ${error.message}`);
    }
  }, [localCategories, connection, serverId]);

  const uncategorizedChannels = localCategories.find(cat => 
    cat.categoryId === null
  )?.chats || [];


  const sortedCategories = localCategories
    .filter(cat => cat.categoryId !== null)
    .sort((a, b) => (a.categoryOrder || a.CategoryOrder) - (b.categoryOrder || b.CategoryOrder));

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable 
        droppableId="categories"
        direction="vertical"
        type="CATEGORY"
        isDropDisabled={false}
      >
        {(provided, snapshot) => (
          <div 
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={`categories-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
            onContextMenu={(e) => {
              if (!e.target.closest('.category-item') && !e.target.closest('.channel-item')) {
                e.preventDefault();
                if (onEmptySpaceContextMenu) {
                  onEmptySpaceContextMenu(e);
                }
              }
            }}
          >
            <Droppable
              droppableId="category-null"
              type="CHAT"
            >
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`uncategorized-channels ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                >
                  {uncategorizedChannels.map((channel, index) => (
                    <ChannelItem
                      key={channel.chatId || channel.ChatId}
                      channel={channel}
                      index={index}
                      isActive={isChannelActive(channel)}
                      onClick={handleChatClick}
                      onContextMenu={(e) => handleChannelContextMenu(e, channel, { categoryId: null, categoryName: null })}
                      onSettings={handleChannelSettings}
                      isDragDisabled={false}
                      userId={userId}
                      userName={userName}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>

            {sortedCategories
              .filter(category => category.categoryId !== null)
              .map((category, index) => (
              <CategoryItem
                key={category.categoryId || category.CategoryId}
                category={category}
                index={index}
                onAddChannel={handleAddChannel}
                onCategoryContextMenu={handleCategoryContextMenu}
                isDragDisabled={false}
              >
                {category.chats?.map((channel, channelIndex) => (
                  <ChannelItem
                    key={channel.chatId || channel.ChatId}
                    channel={channel}
                    index={channelIndex}
                    isActive={isChannelActive(channel)}
                    onClick={handleChatClick}
                    onContextMenu={(e) => handleChannelContextMenu(e, channel, category)}
                    onSettings={handleChannelSettings}
                    isDragDisabled={false}
                    userId={userId}
                    userName={userName}
                  />
                )) || (
                  <div className="no-channels">
                    <p>Нет каналов в этой категории</p>
                  </div>
                )}
              </CategoryItem>
            )) || (
              <div className="no-categories">
                <p>Нет категорий</p>
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default CategoriesList;