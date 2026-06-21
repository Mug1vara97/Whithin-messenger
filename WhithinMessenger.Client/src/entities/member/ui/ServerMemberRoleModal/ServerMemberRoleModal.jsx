import React, { useEffect } from 'react';
import './ServerMemberRoleModal.css';

const ServerMemberRoleModal = ({
  open,
  position,
  member,
  roles = [],
  onClose,
  onToggleRole,
}) => {
  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open || !member) return null;

  const memberRoles = member.roles || [];
  const selectedRoleIds = memberRoles.map((role) => String(role.roleId));

  return (
    <div
      className="server-member-role-modal"
      style={{
        position: 'fixed',
        left: position?.x ?? 0,
        top: position?.y ?? 0,
        zIndex: 1001,
      }}
    >
      <div className="server-member-role-modal__content">
        <div className="server-member-role-modal__header">
          <div className="server-member-role-modal__title-section">
            <h4>Управление ролями</h4>
            <p className="server-member-role-modal__member-name">{member.username}</p>
          </div>
          <button type="button" className="server-member-role-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="server-member-role-modal__roles">
          {roles.length === 0 ? (
            <div className="server-member-role-modal__empty">
              <p>Роли не найдены</p>
              <p>Создайте роли в разделе «Роли»</p>
            </div>
          ) : (
            roles.map((role) => (
              <label key={role.roleId} className="server-member-role-modal__role-item">
                <input
                  type="checkbox"
                  checked={selectedRoleIds.includes(String(role.roleId))}
                  onChange={(event) => onToggleRole?.(role.roleId, event.target.checked)}
                />
                <div
                  className="server-member-role-modal__role-color"
                  style={{ backgroundColor: role.color }}
                />
                <span className="server-member-role-modal__role-name">{role.roleName}</span>
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ServerMemberRoleModal;
