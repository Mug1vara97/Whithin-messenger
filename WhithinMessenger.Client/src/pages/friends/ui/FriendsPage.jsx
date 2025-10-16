import React from 'react';
import { FriendsPanel } from '../../../widgets';
import './FriendsPage.css';

const FriendsPage = ({ onStartChat }) => {
  return (
    <div className="friends-page">
      <FriendsPanel onStartChat={onStartChat} />
    </div>
  );
};

export default FriendsPage;
