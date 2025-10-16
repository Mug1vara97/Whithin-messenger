import React, { useState, useRef, useEffect, memo } from 'react';
import { useMembers } from '../../../entities/member/hooks';
import { useRoles } from '../../../entities/role/hooks';
import { MEMBER_STATUS_COLORS } from '../../../entities/member/model';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import { Button } from '../../../shared/ui/atoms/Button';
import UserAvatar from '../../../shared/ui/atoms/UserAvatar';
import './MemberManagement.css';

const MemberManagement = ({ 
  connection, 
  serverId, 
  userId, 
  userPermissions, 
  isServerOwner,
  onNavigateToChat 
}) => {
  const { members, fetchMembers, kickMember, openPrivateChat } = useMembers(connection, serverId, userId);
  const { roles, fetchRoles, assignRole, removeRole } = useRoles(connection, serverId, userId);

  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    memberId: null
  });

  const [showKickModal, setShowKickModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showRoleManagement, setShowRoleManagement] = useState({
    visible: false,
    x: 0,
    y: 0
  });
  const [selectedMemberForRoles, setSelectedMemberForRoles] = useState(null);

  const contextMenuRef = useRef(null);
  const roleModalRef = useRef(null);

  useEffect(() => {
    if (connection && serverId) {
      fetchMembers();
      fetchRoles();
    }
  }, [connection, serverId, fetchMembers, fetchRoles]);

  const handlePrivateMessage = async (memberId) => {
    try {
      const chatData = await openPrivateChat(memberId);
      onNavigateToChat(chatData.chatId);
      setContextMenu({ ...contextMenu, visible: false });
    } catch (error) {
      console.error('Ошибка при открытии/создании чата:', error);
    }
  };

  const handleKickMember = async (memberId) => {
    try {
      await kickMember(memberId);
      setShowKickModal(false);
    } catch (error) {
      alert(`Ошибка при исключении участника: ${error.message}`);
    }
  };

  const handleRoleToggle = async (roleId, checked) => {
    if (!selectedMemberForRoles) return;

    try {
      if (checked) {
        await assignRole(selectedMemberForRoles.userId, roleId);
      } else {
        await removeRole(selectedMemberForRoles.userId, roleId);
      }
    } catch (error) {
      alert(`Ошибка обновления роли: ${error.message}`);
    }
  };

  const ContextMenu = () => {
    if (!contextMenu.visible) return null;

    const member = members.find(m => m.userId === contextMenu.memberId);
    if (!member) return null;

    const calculatePosition = (x, y) => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const menuWidth = 200;
      const menuHeight = 100;
      
      return {
        x: x + menuWidth > viewportWidth ? x - menuWidth : x,
        y: y + menuHeight > viewportHeight ? y - menuHeight : y
      };
    };

    const { x, y } = calculatePosition(contextMenu.x, contextMenu.y);

    return (
      <div 
        ref={contextMenuRef}
        className="context-menu"
        style={{
          position: 'fixed',
          left: x,
          top: y,
          zIndex: 1000
        }}
      >
        <div className="context-menu-content">
          <button
            className="context-menu-item"
            onClick={() => {
              handlePrivateMessage(member.userId);
            }}
          >
            Написать
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              setSelectedMemberForRoles(member);
              setShowRoleManagement({
                visible: true,
                x: x - 230,
                y: y
              });
              setContextMenu({ ...contextMenu, visible: false });
            }}
          >
            Роли
          </button>
          {(isServerOwner || userPermissions?.kickMembers) && (
            <button
              className="context-menu-item danger"
              onClick={() => {
                setSelectedMember(member);
                setShowKickModal(true);
                setContextMenu({ ...contextMenu, visible: false });
              }}
            >
              Удалить с сервера
            </button>
          )}
        </div>
      </div>
    );
  };

  const RoleManagementModal = () => {
    if (!showRoleManagement.visible || !selectedMemberForRoles) return null;

    const memberRoles = selectedMemberForRoles.roles || [];
    const selectedRoleIds = memberRoles.map(role => role.roleId);
    
    console.log('RoleManagementModal - roles:', roles);
    console.log('RoleManagementModal - selectedMemberForRoles:', selectedMemberForRoles);
    console.log('RoleManagementModal - memberRoles:', memberRoles);
    console.log('RoleManagementModal - selectedRoleIds:', selectedRoleIds);

    return (
      <div 
        ref={roleModalRef}
        className="role-management-modal"
        style={{
          position: 'fixed',
          left: showRoleManagement.x,
          top: showRoleManagement.y,
          zIndex: 1001
        }}
      >
        <div className="modal-content">
          <div className="modal-header">
            <div className="modal-title-section">
              <h4>Управление ролями</h4>
              <p className="member-name">{selectedMemberForRoles.username}</p>
            </div>
            <button 
              className="close-button"
              onClick={() => setShowRoleManagement({ visible: false, x: 0, y: 0 })}
            >
              ×
            </button>
          </div>
          <div className="roles-list">
            {roles.length === 0 ? (
              <div className="no-roles">
                <p>Роли не найдены</p>
                <p>Создайте роли в разделе "Роли"</p>
              </div>
            ) : (
              roles.map(role => (
                <label key={role.roleId} className="role-item">
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.roleId)}
                    onChange={(e) => handleRoleToggle(role.roleId, e.target.checked)}
                  />
                  <div 
                    className="role-color-indicator" 
                    style={{ backgroundColor: role.color }}
                  />
                  <span className="role-name">{role.roleName}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const KickConfirmationModal = () => {
    if (!showKickModal || !selectedMember) return null;

    return (
      <div className="kick-confirmation-modal">
        <div className="modal-content">
          <h3>Вы уверены, что хотите удалить {selectedMember.username} с сервера?</h3>
          <div className="modal-actions">
            <Button 
              variant="secondary"
              onClick={() => setShowKickModal(false)}
            >
              Отмена
            </Button>
            <Button 
              variant="danger"
              onClick={() => handleKickMember(selectedMember.userId)}
            >
              Удалить
            </Button>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      const isContextMenu = e.target.closest('.context-menu');
      const isRoleModal = e.target.closest('.role-management-modal');
      const isKickModal = e.target.closest('.kick-confirmation-modal');

      if (!isContextMenu && !isRoleModal && !isKickModal) {
        setContextMenu(prev => ({ ...prev, visible: false }));
        setShowRoleManagement({ visible: false, x: 0, y: 0 });
        setShowKickModal(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setContextMenu(prev => ({ ...prev, visible: false }));
        setShowRoleManagement({ visible: false, x: 0, y: 0 });
        setShowKickModal(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);


  console.log('MemberManagement - members:', members);
  console.log('MemberManagement - roles:', roles);
  console.log('MemberManagement - connection:', connection);
  console.log('MemberManagement - serverId:', serverId);

  return (
    <div className="member-management">
      <div className="member-management-header">
        <h2>Участники сервера</h2>
        <span className="member-count">{members.length} участников</span>
      </div>
      <div className="members-list">
        {members.length === 0 ? (
          <div className="no-members">
            <p>Участники не найдены</p>
            <p>Connection: {connection ? 'Connected' : 'Not connected'}</p>
            <p>ServerId: {serverId}</p>
          </div>
        ) : (
          members.map(member => (
          <div key={member.userId} className="member-item">
            <div className="member-info">
              <UserAvatar 
                username={member.username}
                avatarUrl={member.avatar ? `${BASE_URL}${member.avatar}` : null}
                avatarColor={member.avatarColor}
                size={40}
              />
              <div className="member-details">
                <span className="member-name">{member.username}</span>
                <div className="member-roles">
                  {member.roles?.map(role => (
                    <div 
                      key={role.roleId}
                      className="member-role"
                      style={{ backgroundColor: role.color }}
                    >
                      {role.roleName}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button 
              className="member-menu-button"
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  memberId: member.userId
                });
              }}
            >
              ⋮
            </button>
          </div>
        ))
        )}
      </div>

      <ContextMenu />
      {showKickModal && <KickConfirmationModal />}
      {showRoleManagement.visible && <RoleManagementModal />}
    </div>
  );
};

export default memo(MemberManagement);
