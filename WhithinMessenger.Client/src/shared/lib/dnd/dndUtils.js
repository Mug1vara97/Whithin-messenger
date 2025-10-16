export const reorderCategories = (list, startIndex, endIndex) => {
  const regularCategories = list.filter(cat => cat.categoryId !== null);
  const nullCategory = list.find(cat => cat.categoryId === null);

  const result = Array.from(regularCategories);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  const orderedCategories = result.map((cat, index) => ({
    ...cat,
    categoryOrder: index
  }));

  return nullCategory ? [nullCategory, ...orderedCategories] : orderedCategories;
};

export const moveChatBetweenCategories = (categories, source, destination) => {
  const sourceCategoryId = source.droppableId.replace('category-', '');
  const destCategoryId = destination.droppableId.replace('category-', '');
  
  const newCategories = categories.map(cat => ({
    ...cat,
    chats: [...(cat.chats || [])]
  }));

  const sourceCategoryIndex = categories.findIndex(
    cat => {
      const id = cat.categoryId || cat.CategoryId;
      return (id === null || id === undefined ? 'null' : id.toString()) === sourceCategoryId;
    }
  );

  const destCategoryIndex = categories.findIndex(
    cat => {
      const id = cat.categoryId || cat.CategoryId;
      return (id === null || id === undefined ? 'null' : id.toString()) === destCategoryId;
    }
  );

  const sourceCategory = newCategories[sourceCategoryIndex];
  const destCategory = newCategories[destCategoryIndex];

  if (sourceCategoryId === destCategoryId && sourceCategory) {
    const chats = [...sourceCategory.chats];
    const [movedChat] = chats.splice(source.index, 1);
    chats.splice(destination.index, 0, {
      ...movedChat,
      chatOrder: destination.index
    });

    sourceCategory.chats = chats.map((chat, index) => ({
      ...chat,
      chatOrder: index
    }));

    return newCategories;
  }

  const sourceChats = [...(sourceCategory?.chats || [])];
  const destChats = [...(destCategory?.chats || [])];

  const [movedChat] = sourceChats.splice(source.index, 1);

  if (sourceCategory) {
    sourceCategory.chats = sourceChats.map((chat, index) => ({
      ...chat,
      chatOrder: index
    }));
  }

  const updatedMovedChat = {
    ...movedChat,
    categoryId: destCategoryId === 'null' ? null : destCategoryId,
    chatOrder: destination.index
  };

  destChats.splice(destination.index, 0, updatedMovedChat);

  if (destCategory) {
    destCategory.chats = destChats.map((chat, index) => ({
      ...chat,
      chatOrder: index
    }));
  } else {
    newCategories.push({
      categoryId: null,
      categoryName: null,
      chats: destChats,
      categoryOrder: -1
    });
  }

  return newCategories;
};

export const canDrag = () => {
  return true; 
};


export const getCategoryIdFromDroppableId = (droppableId) => {
  if (droppableId === 'category-null') return null;
  return droppableId.replace('category-', '');
};


export const getChatIdFromDraggableId = (draggableId) => {
  return draggableId.replace('chat-', '');
};
