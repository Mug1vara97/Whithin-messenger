import React, { useState, useEffect } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { FaLock, FaPlus, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import './CategoryItem.css';

const CategoryItem = ({
  category,
  index,
  onAddChannel,
  onCategoryContextMenu,
  children,
  isDragDisabled = false,
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
          className={`category-item ${
            category.isPrivate || category.IsPrivate ? 'private' : ''
          } ${snapshot.isDragging ? 'dragging' : ''}`}
          data-category-id={categoryId}
          data-open={isOpen ? '' : undefined}
          data-active-open={isOpen && hasActiveChannel ? '' : undefined}
          onContextMenu={handleCategoryContextMenu}
        >
          <div className="category-header" {...provided.dragHandleProps}>
            <button
              type="button"
              className="category-collapse"
              onClick={toggleCollapse}
              aria-expanded={isOpen}
              aria-label={isCollapsed ? 'Развернуть категорию' : 'Свернуть категорию'}
            >
              {isOpen ? (
                <FaChevronDown className="category-collapse__icon" aria-hidden />
              ) : (
                <FaChevronRight className="category-collapse__icon" aria-hidden />
              )}
              <span className="category-name">
                {category.categoryName || category.CategoryName}
              </span>
            </button>
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
              <Droppable droppableId={`category-${categoryId}`} type="CHAT">
                {(dropProvided, dropSnapshot) => (
                  <div
                    className={`channel-list ${
                      dropSnapshot.isDraggingOver ? 'dragging-over' : ''
                    }`}
                    ref={dropProvided.innerRef}
                    {...dropProvided.droppableProps}
                  >
                    {children}
                    {dropProvided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default CategoryItem;
