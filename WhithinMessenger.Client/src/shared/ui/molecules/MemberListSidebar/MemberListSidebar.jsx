import React, { useMemo, useState, useCallback } from 'react';

import { WorkspacePremium } from '@mui/icons-material';

import UserAvatar from '../../atoms/UserAvatar';
import { UserAvatarPresenceDot } from '../../atoms/UserAvatar';
import UserNameplate from '../../atoms/UserNameplate';
import ContextMenu from '../ContextMenu/ContextMenu';
import { useProfileModal } from '../../../lib/contexts/ProfileModalContext';

import {
  groupMembersByPresence,
  groupServerMembersByRoles,
} from '../../../lib/utils/memberListUtils';

import { buildMediaUrl } from '../../../lib/utils/urlHelpers';

import './MemberListSidebar.css';

const MemberListSidebar = ({
  members = [],
  isLoading = false,
  emptyLabel = 'Нет участников',
  groupByRoles = false,
  serverRoles = [],
  getUserContextMenuItems,
}) => {
  const { openProfile } = useProfileModal();
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    member: null,
  });

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false, member: null }));
  }, []);

  const grouped = useMemo(() => {
    if (groupByRoles && serverRoles.length > 0) {
      return groupServerMembersByRoles(members, serverRoles);
    }
    return { mode: 'presence', ...groupMembersByPresence(members) };
  }, [members, groupByRoles, serverRoles]);

  const handleMemberContextMenu = useCallback(
    (event, member) => {
      if (typeof getUserContextMenuItems !== 'function') return;
      const items = getUserContextMenuItems(member);
      if (!items?.length) return;

      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        member,
      });
    },
    [getUserContextMenuItems],
  );

  const contextMenuItems = useMemo(() => {
    if (!contextMenu.member || typeof getUserContextMenuItems !== 'function') return [];
    return getUserContextMenuItems(contextMenu.member, {
      x: contextMenu.x,
      y: contextMenu.y,
    });
  }, [contextMenu.member, contextMenu.x, contextMenu.y, getUserContextMenuItems]);

  const renderMember = (member, showStatusDot = true) => {
    const avatarUrl = member.avatar ? buildMediaUrl(member.avatar) : null;
    const displayNameStyle = member.roleColor ? { color: member.roleColor } : undefined;

    return (
      <div
        key={String(member.userId)}
        className="member-list-item member-list-item--clickable"
        title={member.username}
        role="button"
        tabIndex={0}
        onClick={() => openProfile(member.userId, member.username, member.status)}
        onContextMenu={(event) => handleMemberContextMenu(event, member)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openProfile(member.userId, member.username, member.status);
          }
        }}
      >
        <div className="member-list-item__layout">
          <div className="user-avatar-slot member-list-avatar-wrap">
            <UserAvatar
              displayName={member.displayName}
              login={member.login}
              username={member.login}
              avatarUrl={avatarUrl}
              avatarColor={member.avatarColor}
              avatarDecoration={member.avatarDecoration}
              size={40}
              statusIndicator={<UserAvatarPresenceDot status={member.status} />}
            />
          </div>
          <UserNameplate nameplate={member.nameplate} className="member-list-nameplate">
            <div className="member-list-nameplate__body">
              <span className="member-list-name" style={displayNameStyle}>
                {member.username}
              </span>
              {member.isServerOwner && (
                <WorkspacePremium
                  className="member-list-owner-icon"
                  fontSize="inherit"
                  titleAccess="Владелец сервера"
                />
              )}
            </div>
          </UserNameplate>
        </div>
      </div>
    );
  };

  const renderRoleSection = (section, showStatusDot) => (
    <section key={String(section.roleId)} className="member-list-section">
      <h3
        className="member-list-section-title member-list-section-title--role"
        style={section.roleColor ? { color: section.roleColor } : undefined}
      >
        {section.roleName} — {section.members.length}
      </h3>
      <div className={`member-list-section-items ${showStatusDot ? '' : 'member-list-section-items--offline'}`}>
        {section.members.map((member) => renderMember(member, showStatusDot))}
      </div>
    </section>
  );

  const renderPresenceBucket = (bucket, { showStatusDot, defaultTitle }) => (
    <>
      {bucket.roleSections.map((section) => renderRoleSection(section, showStatusDot))}
      {bucket.ungrouped.length > 0 && (
        <section className="member-list-section">
          <h3 className="member-list-section-title">
            {defaultTitle} — {bucket.ungrouped.length}
          </h3>
          <div className={`member-list-section-items ${showStatusDot ? '' : 'member-list-section-items--offline'}`}>
            {bucket.ungrouped.map((member) => renderMember(member, showStatusDot))}
          </div>
        </section>
      )}
    </>
  );

  const hasOnlineMembers =
    grouped.mode === 'roles'
      ? grouped.online.roleSections.length > 0 || grouped.online.ungrouped.length > 0
      : grouped.online.length > 0;

  const hasOfflineMembers =
    grouped.mode === 'roles'
      ? grouped.offline.roleSections.length > 0 || grouped.offline.ungrouped.length > 0
      : grouped.offline.length > 0;

  return (
    <aside className="member-list-sidebar" aria-label="Список участников">
      <div className="member-list-scroll">
        {isLoading && members.length === 0 && (
          <div className="member-list-empty">Загрузка…</div>
        )}

        {!isLoading && members.length === 0 && (
          <div className="member-list-empty">{emptyLabel}</div>
        )}

        {grouped.mode === 'roles' ? (
          <>
            {hasOnlineMembers &&
              renderPresenceBucket(grouped.online, {
                showStatusDot: true,
                defaultTitle: 'В сети',
              })}
            {hasOfflineMembers &&
              renderPresenceBucket(grouped.offline, {
                showStatusDot: false,
                defaultTitle: 'Не в сети',
              })}
          </>
        ) : (
          <>
            {grouped.online.length > 0 && (
              <section className="member-list-section">
                <h3 className="member-list-section-title">В сети — {grouped.online.length}</h3>
                <div className="member-list-section-items">
                  {grouped.online.map((member) => renderMember(member, true))}
                </div>
              </section>
            )}

            {grouped.offline.length > 0 && (
              <section className="member-list-section">
                <h3 className="member-list-section-title">Не в сети — {grouped.offline.length}</h3>
                <div className="member-list-section-items member-list-section-items--offline">
                  {grouped.offline.map((member) => renderMember(member, false))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <ContextMenu
        isOpen={contextMenu.visible}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        onClose={closeContextMenu}
        items={contextMenuItems}
      />
    </aside>
  );
};

export default MemberListSidebar;
