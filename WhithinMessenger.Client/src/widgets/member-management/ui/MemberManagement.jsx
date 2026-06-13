import React, { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { Search, SwapVert, MoreVert } from '@mui/icons-material';
import { useMembers } from '../../../entities/member/hooks';
import { useRoles } from '../../../entities/role/hooks';
import { canManageRoles } from '../../../entities/role/lib/serverPermissions';
import { useFriends, useFriendRequests } from '../../../entities/friend';
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
  onNavigateToChat,
}) => {
  const { members, fetchMembers, kickMember, openPrivateChat } = useMembers(connection, serverId, userId);
  const { roles, fetchRoles, assignRole, removeRole } = useRoles(connection, serverId, userId);
  const { friends, fetchFriends } = useFriends();
  const { pendingRequests, sentRequests, sendRequest, acceptRequest } = useFriendRequests();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  const friendActionForMember = useCallback(
    (memberId) => {
      const mid = String(memberId);
      const me = String(userId ?? '');
      if (!me || mid === me) return { kind: 'self' };
      if (friends.some((f) => String(f.userId) === mid)) return { kind: 'friend' };
      const incoming = pendingRequests.find((r) => String(r.requesterId) === mid);
      if (incoming) return { kind: 'incoming', requestId: incoming.id };
      if (sentRequests.some((r) => String(r.addresseeId) === mid)) return { kind: 'outgoing' };
      return { kind: 'stranger' };
    },
    [friends, pendingRequests, sentRequests, userId],
  );

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = [...members];
    if (query) {
      list = list.filter((m) => (m.username || '').toLowerCase().includes(query));
    }
    list.sort((a, b) => {
      const cmp = (a.username || '').localeCompare(b.username || '', 'ru', { sensitivity: 'base' });
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [members, searchQuery, sortAsc]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSortAsc(true);
  };

  const handleAddFriend = async (memberId) => {
    try {
      await sendRequest(memberId);
      await fetchFriends();
      setContextMenu((prev) => ({ ...prev, visible: false }));
    } catch (error) {
      alert(error?.message || 'Не удалось отправить запрос в друзья');
    }
  };

  const handleAcceptIncomingFriend = async (friendshipId) => {
    try {
      await acceptRequest(friendshipId);
      await fetchFriends();
      setContextMenu((prev) => ({ ...prev, visible: false }));
    } catch (error) {
      alert(error?.message || 'Не удалось принять запрос');
    }
  };

  const userCanManageMemberRoles = isServerOwner || canManageRoles(userPermissions, isServerOwner);
  const userCanKickMembers = isServerOwner || userPermissions?.kickMembers;

  const memberHasMenuActions = useCallback(
    (member) => {
      const fa = friendActionForMember(member.userId);
      if (fa.kind !== 'self') return true;
      if (userCanManageMemberRoles) return true;
      if (userCanKickMembers && String(member.userId) !== String(userId)) return true;
      return false;
    },
    [friendActionForMember, userCanManageMemberRoles, userCanKickMembers, userId],
  );

  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    memberId: null,
  });

  const [showKickModal, setShowKickModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showRoleManagement, setShowRoleManagement] = useState({
    visible: false,
    x: 0,
    y: 0,
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
      const chatId = chatData?.chatId ?? chatData?.ChatId;
      if (!chatId) {
        throw new Error('Сервер не вернул идентификатор чата');
      }
      if (typeof onNavigateToChat === 'function') {
        onNavigateToChat(chatId);
      }
      setContextMenu((prev) => ({ ...prev, visible: false }));
    } catch (error) {
      console.error('Ошибка при открытии/создании чата:', error);
      alert(error?.message || 'Не удалось открыть личный чат');
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

  useEffect(() => {
    if (!selectedMemberForRoles) return;
    const updatedMember = members.find(
      (member) => String(member.userId) === String(selectedMemberForRoles.userId),
    );
    if (updatedMember) {
      setSelectedMemberForRoles(updatedMember);
    }
  }, [members, selectedMemberForRoles?.userId]);

  const handleRoleToggle = async (roleId, checked) => {
    if (!selectedMemberForRoles) return;

    try {
      if (checked) {
        await assignRole(selectedMemberForRoles.userId, roleId);
      } else {
        await removeRole(selectedMemberForRoles.userId, roleId);
      }
      await fetchMembers();
    } catch (error) {
      alert(`Ошибка обновления роли: ${error.message}`);
    }
  };

  const openRoleModal = (member, x, y) => {
    setSelectedMemberForRoles(member);
    setShowRoleManagement({
      visible: true,
      x: Math.max(8, x - 230),
      y,
    });
  };

  const ContextMenu = () => {
    if (!contextMenu.visible) return null;

    const member = members.find((m) => String(m.userId) === String(contextMenu.memberId));
    if (!member) return null;

    const menuWidth = 220;
    const menuHeight = 160;
    const x =
      contextMenu.x + menuWidth > window.innerWidth ? contextMenu.x - menuWidth : contextMenu.x;
    const y =
      contextMenu.y + menuHeight > window.innerHeight ? contextMenu.y - menuHeight : contextMenu.y;

    return (
      <div
        ref={contextMenuRef}
        className="context-menu"
        style={{ position: 'fixed', left: x, top: y, zIndex: 1000 }}
      >
        <div className="context-menu-content">
          {(() => {
            const fa = friendActionForMember(member.userId);
            if (fa.kind === 'self') return null;
            if (fa.kind === 'friend') {
              return (
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => handlePrivateMessage(member.userId)}
                >
                  Написать
                </button>
              );
            }
            if (fa.kind === 'incoming') {
              return (
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => handleAcceptIncomingFriend(fa.requestId)}
                >
                  Принять запрос в друзья
                </button>
              );
            }
            if (fa.kind === 'outgoing') {
              return (
                <button type="button" className="context-menu-item context-menu-item--disabled" disabled>
                  Запрос отправлен
                </button>
              );
            }
            return (
              <button
                type="button"
                className="context-menu-item"
                onClick={() => handleAddFriend(member.userId)}
              >
                Добавить в друзья
              </button>
            );
          })()}
          {(isServerOwner || canManageRoles(userPermissions, isServerOwner)) && (
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                openRoleModal(member, x, y);
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
            >
              Роли
            </button>
          )}
          {(isServerOwner || userPermissions?.kickMembers) && String(member.userId) !== String(userId) && (
            <button
              type="button"
              className="context-menu-item danger"
              onClick={() => {
                setSelectedMember(member);
                setShowKickModal(true);
                setContextMenu((prev) => ({ ...prev, visible: false }));
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
    const selectedRoleIds = memberRoles.map((role) => String(role.roleId));

    return (
      <div
        ref={roleModalRef}
        className="role-management-modal"
        style={{
          position: 'fixed',
          left: showRoleManagement.x,
          top: showRoleManagement.y,
          zIndex: 1001,
        }}
      >
        <div className="modal-content">
          <div className="modal-header">
            <div className="modal-title-section">
              <h4>Управление ролями</h4>
              <p className="member-name">{selectedMemberForRoles.username}</p>
            </div>
            <button
              type="button"
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
                <p>Создайте роли в разделе «Роли»</p>
              </div>
            ) : (
              roles.map((role) => (
                <label key={role.roleId} className="role-item">
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(String(role.roleId))}
                    onChange={(e) => handleRoleToggle(role.roleId, e.target.checked)}
                  />
                  <div className="role-color-indicator" style={{ backgroundColor: role.color }} />
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
            <Button variant="secondary" onClick={() => setShowKickModal(false)}>
              Отмена
            </Button>
            <Button variant="danger" onClick={() => handleKickMember(selectedMember.userId)}>
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
        setContextMenu((prev) => ({ ...prev, visible: false }));
        setShowRoleManagement({ visible: false, x: 0, y: 0 });
        setShowKickModal(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setContextMenu((prev) => ({ ...prev, visible: false }));
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

  const primaryRoleColor = (member) => member.roles?.[0]?.color;

  return (
    <div className="member-management">
      <div className="members-table-card">
        <div className="members-table-toolbar">
          <h3 className="members-table-toolbar__title">Участники сервера</h3>
          <div className="members-table-toolbar__actions">
            <label className="members-search">
              <Search className="members-search__icon" />
              <input
                type="text"
                className="members-search__input"
                placeholder="Поиск по имени пользователя"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="members-toolbar-btn"
              onClick={() => setSortAsc((v) => !v)}
            >
              <SwapVert fontSize="small" />
              Сортировать
            </button>
            <button type="button" className="members-toolbar-btn members-toolbar-btn--muted" onClick={handleClearFilters}>
              Очистить
            </button>
          </div>
        </div>

        <div className="members-table">
          <div className="members-table-head">
            <div className="members-table-cell members-table-cell--name">Имя</div>
            <div className="members-table-cell members-table-cell--roles">Роли</div>
            <div className="members-table-cell members-table-cell--actions" />
          </div>

          <div className="members-table-body">
            {filteredMembers.length === 0 ? (
              <div className="no-members">
                <p>{searchQuery.trim() ? 'Никого не найдено' : 'Участники не найдены'}</p>
              </div>
            ) : (
              filteredMembers.map((member) => (
                <div key={member.userId} className="members-table-row">
                  <div className="members-table-cell members-table-cell--name">
                    <UserAvatar
                      username={member.username}
                      avatarUrl={member.avatar ? `${BASE_URL}${member.avatar}` : null}
                      avatarColor={member.avatarColor}
                      size={36}
                    />
                    <div className="member-name-block">
                      <span
                        className="member-display-name"
                        style={primaryRoleColor(member) ? { color: primaryRoleColor(member) } : undefined}
                      >
                        {member.username}
                      </span>
                      <span className="member-handle">{member.username}</span>
                    </div>
                  </div>
                  <div className="members-table-cell members-table-cell--roles">
                    {member.roles?.length ? (
                      member.roles.map((role) => (
                        <span
                          key={role.roleId}
                          className="member-role-pill"
                          style={{
                            color: role.color,
                            backgroundColor: `${role.color}22`,
                            borderColor: `${role.color}55`,
                          }}
                        >
                          <span className="member-role-pill__dot" style={{ backgroundColor: role.color }} />
                          {role.roleName}
                        </span>
                      ))
                    ) : (
                      <span className="member-role-empty">—</span>
                    )}
                  </div>
                  <div className="members-table-cell members-table-cell--actions">
                    {memberHasMenuActions(member) && (
                      <button
                        type="button"
                        className="member-action-btn"
                        title="Действия"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenu({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            memberId: member.userId,
                          });
                        }}
                      >
                        <MoreVert fontSize="small" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="members-table-footer">
          Показаны {filteredMembers.length} участников
        </div>
      </div>

      <ContextMenu />
      {showKickModal && <KickConfirmationModal />}
      {showRoleManagement.visible && <RoleManagementModal />}
    </div>
  );
};

export default memo(MemberManagement);
