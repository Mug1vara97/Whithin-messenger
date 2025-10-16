
import React, { useState, useEffect } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { FaLock, FaPlus } from 'react-icons/fa';
import './CategoryItem.css';

const CategoryItem = ({ 
    category,
    index,
    onAddChannel,
    onCategoryContextMenu,
    children,
    isDragDisabled = false
}) => {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const categoryId = category.categoryId || category.CategoryId;
        const savedState = localStorage.getItem(`categoryCollapsed_${categoryId}`);
        return savedState ? JSON.parse(savedState) : false;
    });

    useEffect(() => {
        const categoryId = category.categoryId || category.CategoryId;
        localStorage.setItem(
            `categoryCollapsed_${categoryId}`, 
            JSON.stringify(isCollapsed)
        );
    }, [isCollapsed, category.categoryId, category.CategoryId]);

    const toggleCollapse = (e) => {
        e.stopPropagation();
        setIsCollapsed(!isCollapsed);
    };

    const handleAddChannel = (e) => {
        e.stopPropagation();
        if (onAddChannel) {
            onAddChannel(category.categoryId || category.CategoryId);
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


    return (
        <Draggable
            draggableId={`category-${category.categoryId || category.CategoryId}`}
            index={index}
            isDragDisabled={isDragDisabled}
        >
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`category-item ${(category.isPrivate || category.IsPrivate) ? 'private' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
                    onContextMenu={handleCategoryContextMenu}
                >
                    <div 
                        className="category-header"
                        {...provided.dragHandleProps}
                    >
                        <div className="category-name-container">
                            {(category.isPrivate || category.IsPrivate) && <FaLock className="private-icon" />}
                            <span 
                                className="category-name"
                                onClick={toggleCollapse}
                                aria-label={isCollapsed ? "Развернуть категорию" : "Свернуть категорию"}
                            >
                                {category.categoryName || category.CategoryName}
                            </span>
                        </div>
                        <div className="category-actions">
                            <button
                                className="add-channel-button"
                                onClick={handleAddChannel}
                                title="Создать канал"
                            >
                                <FaPlus className="add-icon" />
                            </button>
                        </div>
                    </div>
                    
                    {!isCollapsed && (
                        <Droppable
                            droppableId={`category-${category.categoryId || category.CategoryId}`}
                            type="CHAT"
                        >
                            {(provided, snapshot) => (
                                <div 
                                    className={`channel-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                >
                                    {children}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    )}
                </div>
            )}
        </Draggable>
    );
};

export default CategoryItem;