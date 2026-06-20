import React from 'react';
import { Button } from '../../../shared/ui/atoms/Button';
import { DISPLAY_NAME_MAX_LENGTH } from '../../../shared/lib/utils/userDisplayNameHelpers';
import './ServerMemberNicknameModal.css';

const ServerMemberNicknameModal = ({
  open,
  member,
  currentUserId,
  nicknameDraft,
  saving = false,
  onDraftChange,
  onSave,
  onClose,
}) => {
  if (!open || !member) return null;

  const isSelf = String(member.userId) === String(currentUserId);
  const loginLabel = member.login || member.username;

  return (
    <div className="kick-confirmation-modal nickname-modal">
      <div className="modal-content">
        <h3>{isSelf ? 'Мой серверный ник' : `Серверный ник — ${member.username}`}</h3>
        <p className="nickname-modal__hint">
          Переопределяет глобальный ник только на этом сервере. Пустое значение — сброс.
          {loginLabel ? ` Логин: @${loginLabel}` : ''}
        </p>
        <input
          type="text"
          className="nickname-modal__input"
          value={nicknameDraft}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          placeholder={member.username}
          onChange={(e) => onDraftChange(e.target.value)}
        />
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ServerMemberNicknameModal;
