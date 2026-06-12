import React, { useMemo } from 'react';

import { WorkspacePremium } from '@mui/icons-material';

import UserAvatar from '../../atoms/UserAvatar';

import {

  getUserStatusColor,

  getUserStatusLabel,

  normalizeUserStatus,

  PRESENCE_STATUS,

} from '../../../lib/utils/userStatus';

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

}) => {

  const grouped = useMemo(() => {

    if (groupByRoles && serverRoles.length > 0) {

      return groupServerMembersByRoles(members, serverRoles);

    }

    return { mode: 'presence', ...groupMembersByPresence(members) };

  }, [members, groupByRoles, serverRoles]);



  const renderMember = (member, showStatusDot = true) => {

    const avatarUrl = member.avatar ? buildMediaUrl(member.avatar) : null;

    const displayNameStyle = member.roleColor ? { color: member.roleColor } : undefined;

    const normalizedStatus = normalizeUserStatus(member.status);

    const shouldShowStatusDot = showStatusDot && normalizedStatus !== PRESENCE_STATUS.OFFLINE;



    return (

      <div key={String(member.userId)} className="member-list-item" title={member.username}>

        <div className="member-list-avatar-wrap">

          <UserAvatar

            username={member.username}

            avatarUrl={avatarUrl}

            avatarColor={member.avatarColor}

            size={32}

          />

          {shouldShowStatusDot && (

            <span

              className="member-list-status-dot"

              style={{ backgroundColor: getUserStatusColor(member.status) }}

              title={getUserStatusLabel(member.status)}

            />

          )}

        </div>

        <span className="member-list-name" style={displayNameStyle}>

          {member.username}

        </span>

        {member.isServerOwner && (

          <WorkspacePremium className="member-list-owner-icon" fontSize="inherit" titleAccess="Владелец сервера" />

        )}

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

    </aside>

  );

};



export default MemberListSidebar;


