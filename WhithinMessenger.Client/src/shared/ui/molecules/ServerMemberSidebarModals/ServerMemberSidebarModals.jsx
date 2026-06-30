import React from 'react';

import ServerMemberNicknameModal from '../../../../entities/member/ui/ServerMemberNicknameModal';
import ServerMemberRoleModal from '../../../../entities/member/ui/ServerMemberRoleModal/ServerMemberRoleModal';

const ServerMemberSidebarModals = ({
  userId,
  nicknameModal,
  roleModal,
  kickModal,
}) => (
  <>
    <ServerMemberNicknameModal
      open={nicknameModal.open}
      member={nicknameModal.member}
      currentUserId={userId}
      nicknameDraft={nicknameModal.nicknameDraft}
      saving={nicknameModal.saving}
      onDraftChange={nicknameModal.onDraftChange}
      onSave={nicknameModal.onSave}
      onClose={nicknameModal.onClose}
    />

    <ServerMemberRoleModal
      open={roleModal.open}
      position={roleModal.position}
      member={roleModal.member}
      roles={roleModal.roles}
      onClose={roleModal.onClose}
      onToggleRole={roleModal.onToggleRole}
    />

    {kickModal.member && (
      <div
        className="modal-overlay"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            kickModal.onCancel();
          }
        }}
      >
        <div className="modal-content call-mode-modal">
          <h3>Удалить с сервера</h3>
          <p>
            Вы уверены, что хотите удалить {kickModal.member.username} с сервера?
          </p>
          <div className="call-mode-actions">
            <button
              type="button"
              className="call-mode-button direct"
              onClick={kickModal.onCancel}
            >
              Отмена
            </button>
            <button
              type="button"
              className="call-mode-button notify"
              onClick={() => void kickModal.onConfirm()}
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);

export default ServerMemberSidebarModals;
