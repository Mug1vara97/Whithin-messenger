import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { CategoryItem, ChannelItem } from '../../../../shared/ui/molecules';
import { reorderCategories, moveChatBetweenCategories } from '../../../../shared/lib/dnd';
import voiceChannelService from '../../../../shared/lib/services/voiceChannelService';
import './CategoriesList.css';

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

  // Получаем список голосовых каналов
  const voiceChannelIds = useMemo(() => {
    const ids = [];
    localCategories.forEach(category => {
      const chats = category.chats || category.Chats || [];
      chats.forEach(chat => {
        const isVoice = chat.chatType === 4 || chat.typeId === 4 || chat.TypeId === 4;
        if (isVoice) {
          ids.push(chat.chatId || chat.ChatId);
        }
      });
    });
    return ids;
  }, [localCategories]);

  // Храним предыдущие ID для сравнения
  const prevVoiceChannelIdsRef = useRef([]);
  const isConnectedRef = useRef(false);

  // Подключаемся к voice-server и запрашиваем участников голосовых каналов
  useEffect(() => {
    if (voiceChannelIds.length === 0) return;

    // Сравниваем с предыдущими ID чтобы избежать лишних вызовов
    const prevIds = prevVoiceChannelIdsRef.current;
    const idsChanged = voiceChannelIds.length !== prevIds.length || 
      voiceChannelIds.some((id, i) => id !== prevIds[i]);

    if (!idsChanged && isConnectedRef.current) {
      return; // Ничего не изменилось
    }

    prevVoiceChannelIdsRef.current = [...voiceChannelIds];

    // Подключаемся к voice-server только один раз
    if (!isConnectedRef.current) {
      voiceChannelService.connect();
      isConnectedRef.current = true;
    }

    // Запрашиваем участников для всех голосовых каналов
    voiceChannelIds.forEach(channelId => {
      voiceChannelService.subscribeToChannel(channelId);
    });

    return () => {
      // Отписываемся от каналов при размонтировании
      voiceChannelIds.forEach(channelId => {
        voiceChannelService.unsubscribeFromChannel(channelId);
      });
    };
  }, [voiceChannelIds.join(',')]);

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