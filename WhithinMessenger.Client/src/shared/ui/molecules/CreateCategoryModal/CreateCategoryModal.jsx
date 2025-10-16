import React, { useState, useEffect } from 'react';
import './CreateCategoryModal.css';

const CreateCategoryModal = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [categoryName, setCategoryName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setCategoryName('');
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!categoryName.trim()) {
      newErrors.name = 'Название категории не может быть пустым';
    } else if (categoryName.length < 2) {
      newErrors.name = 'Название категории должно содержать минимум 2 символа';
    } else if (categoryName.length > 50) {
      newErrors.name = 'Название категории не может содержать более 50 символов';
    } else if (!/^[a-zA-Zа-яА-Я0-9\s\-_]+$/.test(categoryName)) {
      newErrors.name = 'Название категории может содержать только буквы, цифры, пробелы, дефисы и подчеркивания';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      await onSubmit({
        categoryName: categoryName.trim()
      });
      
      setCategoryName('');
      onClose();
    } catch (error) {
      setErrors({ submit: error.message || 'Ошибка при создании категории' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Создать категорию</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="categoryName">Название категории</label>
            <input
              id="categoryName"
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Новая категория"
              className={errors.name ? 'error' : ''}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            {errors.name && <div className="error-message">{errors.name}</div>}
          </div>

          {errors.submit && (
            <div className="error-message submit-error">{errors.submit}</div>
          )}

          <div className="modal-footer">
            <button 
              type="button" 
              className="cancel-button" 
              onClick={onClose}
              disabled={isLoading}
            >
              Отмена
            </button>
            <button 
              type="submit" 
              className="create-button"
              disabled={isLoading}
            >
              {isLoading ? 'Создание...' : 'Создать категорию'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCategoryModal;
