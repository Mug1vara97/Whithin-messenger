import React, { useState, useEffect } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { FaLock, FaPlus } from 'react-icons/fa';
import CategoryBranchTree from './CategoryBranchTree';
import './CategoryItem.css';

const CategoryItem = ({
  category,
  index,
  onAddChannel,
  onCategoryContextMenu,
  children,
  isDragDisabled = false,
  activeChatId = null,
  hasActiveChannel = false,
}) => {
  const categoryId = category.categoryId || category.CategoryId;

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const savedState = localStorage.getItem(`categoryCollapsed_${categoryId}`);
    return savedState ? JSON.parse(savedState) : false;
  });

  useEffect(() => {
    localStorage.setItem(`categoryCollapsed_${categoryId}`, JSON.stringify(isCollapsed));
  }, [isCollapsed, categoryId]);

  const toggleCollapse = (e) => {
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
  };

  const handleAddChannel = (e) => {
    e.stopPropagation();
    if (onAddChannel) {
      onAddChannel(categoryId);
    }
  };

  const handleCategoryContextMenu = (e) => {
    if (e.target.closest('.channel-item')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (onCategoryContextMenu) {
      onCategoryContextMenu(e, category);
    }
  };

  const isOpen = !isCollapsed;

  return (
    <Draggable
      draggableId={`category-${categoryId}`}
      index={index}
      isDragDisabled={isDragDisabled}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`category-item branched ${
            category.isPrivate || category.IsPrivate ? 'private' : ''
          } ${snapshot.isDragging ? 'dragging' : ''}`}
          data-category-id={categoryId}
          data-open={isOpen ? '' : undefined}
          data-active-open={isOpen && hasActiveChannel ? '' : undefined}
          onContextMenu={handleCategoryContextMenu}
        >
          <div className="category-header" {...provided.dragHandleProps}>
            <div className="category-name-container">
              <span
                className="category-name"
                onClick={toggleCollapse}
                aria-expanded={isOpen}
                aria-label={isCollapsed ? 'Развернуть категорию' : 'Свернуть категорию'}
              >
                {category.categoryName || category.CategoryName}
              </span>
            </div>
            <div className="category-actions">
              {(category.isPrivate || category.IsPrivate) && (
                <span className="category-private-icon" title="Приватная категория">
                  <FaLock aria-hidden />
                </span>
              )}
              {onAddChannel && (
                <button
                  className="add-channel-button"
                  onClick={handleAddChannel}
                  title="Создать канал"
                >
                  <FaPlus className="add-icon" />
                </button>
              )}
            </div>
          </div>

          {isOpen && (
            <div className="category-body">
              <div className="category-fold">
                <Droppable droppableId={`category-${categoryId}`} type="CHAT">
                  {(dropProvided, dropSnapshot) => (
                    <div
                      className={`channel-list ${
                        dropSnapshot.isDraggingOver ? 'dragging-over' : ''
                      }`}
                      ref={dropProvided.innerRef}
                      {...dropProvided.droppableProps}
                    >
                      <CategoryBranchTree activeChatId={activeChatId}>
                        {children}
                        {dropProvided.placeholder}
                      </CategoryBranchTree>
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default CategoryItem;
