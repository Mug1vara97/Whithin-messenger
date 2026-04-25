import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, Headset, HeadsetOff, Settings as SettingsIcon } from '@mui/icons-material';
import { userApi } from '../../../../entities/user/api';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import { useConnectionContext } from '../../../lib/contexts/ConnectionContext';
import { useGlobalCall } from '../../../lib/hooks/useGlobalCall';
import { useGlobalHotkeys } from '../../../lib/hooks/useGlobalHotkeys';
import {
    getUserStatusColor,
    getUserStatusLabel,
    getUserStatusOptions,
    normalizeUserStatus,
    PRESENCE_STATUS,
    toBackendUserStatus
} from '../../../lib/utils/userStatus';
import { SettingsModal } from '../../organisms';
import styles from './UserPanel.module.css';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

const UserPanel = ({ 
    userId, 
    username, 
    isOpen
}) => {
    // Подключаемся к глобальному состоянию звонка напрямую в компоненте
    const { isMuted, isGlobalAudioMuted, toggleMute, toggleGlobalAudio } = useGlobalCall();
    
    // Подключаем глобальные горячие клавиши
    useGlobalHotkeys(toggleMute, toggleGlobalAudio);
    
    const [userProfile, setUserProfile] = useState(null);
    const [showProfile, setShowProfile] = useState(false);
    const [showBannerEditor, setShowBannerEditor] = useState(false);
    const [bannerInput, setBannerInput] = useState('');
    const fileInputRef = useRef(null);
    const [showAvatarEditor, setShowAvatarEditor] = useState(false);
    const [avatarInput, setAvatarInput] = useState('');
    const avatarFileInputRef = useRef(null);
    const [showSettings, setShowSettings] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(PRESENCE_STATUS.ONLINE);
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
    const [, setIsStatusUpdating] = useState(false);
    const manualStatusRef = useRef(PRESENCE_STATUS.ONLINE);
    const currentStatusRef = useRef(PRESENCE_STATUS.ONLINE);
    const notificationConnectionRef = useRef(null);
    const statusMenuRef = useRef(null);
    const { getConnection } = useConnectionContext();

    const getStorageKey = () => (userId ? `whithin:user-status:${userId}` : 'whithin:user-status');

    const fetchUserProfile = async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/profile/${userId}/profile`);
            if (response.ok) {
                const data = await response.json();
                if (data.avatar && !data.avatar.startsWith('http')) {
                    data.avatar = `${BASE_URL}${data.avatar}`;
                }
                setUserProfile(data);
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
    };

    const toggleProfile = () => {
        setShowProfile(!showProfile);
    };

    const updateAvatar = async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/profile/update-avatar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    UserId: userId,
                    Avatar: avatarInput
                })
            });

            if (response.ok) {
                const updatedProfile = await response.json();
                setUserProfile(prev => ({ ...prev, avatar: updatedProfile.Avatar }));
                setShowAvatarEditor(false);
                setAvatarInput('');
            }
        } catch (error) {
            console.error('Error updating avatar:', error);
        }
    };

    const handleAvatarFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${BASE_URL}/api/profile/upload/avatar`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const { url } = await response.json();
                setAvatarInput(url);
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
        }
    };

    const updateBanner = async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/profile/update-banner`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    UserId: userId,
                    Banner: bannerInput
                })
            });

            if (response.ok) {
                const updatedProfile = await response.json();
                setUserProfile(prev => ({ ...prev, banner: updatedProfile.Banner }));
                setShowBannerEditor(false);
                setBannerInput('');
            }
        } catch (error) {
            console.error('Error updating banner:', error);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${BASE_URL}/api/profile/upload/banner`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const { url } = await response.json();
                setBannerInput(url);
            }
        } catch (error) {
            console.error('Error uploading banner:', error);
        }
    };

    useEffect(() => {
        if (isOpen && userId) {
            fetchUserProfile();
        }
    }, [isOpen, userId]);

    useEffect(() => {
        if (!isOpen) return;

        const storageKey = getStorageKey();
        const savedStatus = localStorage.getItem(storageKey);
        if (savedStatus) {
            const normalizedSavedStatus = normalizeUserStatus(savedStatus);
            setCurrentStatus(normalizedSavedStatus);
            manualStatusRef.current = normalizedSavedStatus;
            currentStatusRef.current = normalizedSavedStatus;
        } else {
            setCurrentStatus(PRESENCE_STATUS.ONLINE);
            manualStatusRef.current = PRESENCE_STATUS.ONLINE;
            currentStatusRef.current = PRESENCE_STATUS.ONLINE;
        }
    }, [isOpen, userId]);

    useEffect(() => {
        if (!isStatusMenuOpen) return undefined;

        const handleClickOutside = (event) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) {
                setIsStatusMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isStatusMenuOpen]);

    useEffect(() => {
        if (!isStatusMenuOpen) return undefined;

        const handleEscapeClose = (event) => {
            if (event.key === 'Escape') {
                setIsStatusMenuOpen(false);
            }
        };

        document.addEventListener('keydown', handleEscapeClose);
        return () => document.removeEventListener('keydown', handleEscapeClose);
    }, [isStatusMenuOpen]);

    const applyStatus = async (statusValue, isManualChange = false) => {
        const normalizedStatus = normalizeUserStatus(statusValue);
        const storageKey = getStorageKey();

        setCurrentStatus(normalizedStatus);
        currentStatusRef.current = normalizedStatus;
        localStorage.setItem(storageKey, normalizedStatus);

        if (isManualChange) {
            manualStatusRef.current = normalizedStatus;
        }

        if (!userId) return;

        try {
            setIsStatusUpdating(true);
            await userApi.updateStatus(userId, toBackendUserStatus(normalizedStatus));
        } catch (error) {
            console.error('Error updating user status:', error);
        } finally {
            setIsStatusUpdating(false);
        }
    };

    const handleStatusChange = async (statusValue) => {
        setIsStatusMenuOpen(false);
        await applyStatus(statusValue, true);
    };

    useEffect(() => {
        if (!isOpen || !userId) return undefined;

        let idleTimerId = null;

        const resetIdleTimer = () => {
            if (idleTimerId) {
                window.clearTimeout(idleTimerId);
            }

            if (
                manualStatusRef.current === PRESENCE_STATUS.ONLINE &&
                currentStatusRef.current === PRESENCE_STATUS.INACTIVE
            ) {
                applyStatus(PRESENCE_STATUS.ONLINE);
            }

            idleTimerId = window.setTimeout(() => {
                if (
                    manualStatusRef.current === PRESENCE_STATUS.ONLINE &&
                    currentStatusRef.current === PRESENCE_STATUS.ONLINE
                ) {
                    applyStatus(PRESENCE_STATUS.INACTIVE);
                }
            }, INACTIVITY_TIMEOUT_MS);
        };

        const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
        events.forEach((eventName) => {
            window.addEventListener(eventName, resetIdleTimer, { passive: true });
        });

        resetIdleTimer();

        return () => {
            if (idleTimerId) {
                window.clearTimeout(idleTimerId);
            }
            events.forEach((eventName) => {
                window.removeEventListener(eventName, resetIdleTimer);
            });
        };
    }, [isOpen, userId]);

    useEffect(() => {
        if (!isOpen || !userId || !getConnection) return undefined;

        let mounted = true;

        const setupRealtimeStatus = async () => {
            try {
                const notificationConnection = await getConnection('notificationhub', userId);
                if (!mounted) return;
                notificationConnectionRef.current = notificationConnection;

                const onUserStatusChanged = (payload) => {
                    const changedUserId = payload?.userId ?? payload?.UserId;
                    if (String(changedUserId) !== String(userId)) {
                        return;
                    }

                    const normalizedStatus = normalizeUserStatus(payload?.status ?? payload?.Status);
                    setCurrentStatus(normalizedStatus);
                    currentStatusRef.current = normalizedStatus;
                    localStorage.setItem(getStorageKey(), normalizedStatus);
                };

                notificationConnection.on('UserStatusChanged', onUserStatusChanged);
            } catch (error) {
                console.error('Error setting up realtime status in user panel:', error);
            }
        };

        setupRealtimeStatus();

        return () => {
            mounted = false;
            if (notificationConnectionRef.current) {
                notificationConnectionRef.current.off('UserStatusChanged');
            }
        };
    }, [isOpen, userId, getConnection]);

    if (!isOpen) return null;

    return (
        <>
            <div className={styles['user-panel']}>
                <div className={styles['user-panel-content']}>
                    <div className={styles['user-avatar-container']}>
                        <div 
                            className={styles['user-avatar']} 
                            style={{ 
                                backgroundColor: userProfile?.avatarColor || '#5865F2', 
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%'
                            }}
                            onClick={toggleProfile}
                        >
                            {userProfile?.avatar ? (
                                <img 
                                    src={userProfile.avatar.startsWith('http') ? userProfile.avatar : `${BASE_URL}${userProfile.avatar}`} 
                                    alt="User avatar" 
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        borderRadius: '50%',
                                        objectFit: 'cover'
                                    }}
                                />
                            ) : (
                                username.charAt(0).toUpperCase()
                            )}
                        </div>
                        <button
                            className={styles['user-avatar-status-button']}
                            onClick={() => setIsStatusMenuOpen((prev) => !prev)}
                            title="Изменить статус"
                            type="button"
                        >
                            <span
                                className={styles['user-avatar-status']}
                                style={{ backgroundColor: getUserStatusColor(currentStatus) }}
                            />
                        </button>
                    </div>
                    
                    <div className={styles['user-info']}>
                        <span className={styles.username}>{username}</span>
                        <div className={styles['status-control']} ref={statusMenuRef}>
                            <button
                                className={styles['status-button']}
                                onClick={() => setIsStatusMenuOpen((prev) => !prev)}
                                title="Изменить статус"
                                type="button"
                            >
                                <span className={styles['user-status-text']}>{getUserStatusLabel(currentStatus)}</span>
                            </button>

                            {isStatusMenuOpen && (
                                <div className={styles['status-menu']}>
                                    {getUserStatusOptions().map((statusOption) => (
                                        <button
                                            key={statusOption.value}
                                            className={`${styles['status-menu-item']} ${currentStatus === statusOption.value ? styles['status-menu-item-active'] : ''}`}
                                            onClick={() => handleStatusChange(statusOption.value)}
                                            type="button"
                                        >
                                            <span
                                                className={styles['status-dot']}
                                                style={{ backgroundColor: statusOption.color }}
                                            />
                                            <span>{statusOption.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className={styles['voice-controls']}>
                        <button
                            className={styles['voice-control-button']}
                            onClick={toggleMute}
                            title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
                        >
                            {isMuted ? <MicOff fontSize="small" /> : <Mic fontSize="small" />}
                        </button>
                        
                        <button
                            className={styles['voice-control-button']}
                            onClick={toggleGlobalAudio}
                            title={!isGlobalAudioMuted ? "Выключить звук" : "Включить звук"}
                        >
                            {!isGlobalAudioMuted ? <Headset fontSize="small" /> : <HeadsetOff fontSize="small" />}
                        </button>

                        <button
                            className={styles['voice-control-button']}
                            onClick={() => setShowSettings(true)}
                            title="Настройки"
                        >
                            <SettingsIcon fontSize="small" />
                        </button>
                    </div>
                </div>
            </div>

            {showProfile && (
                <div className={styles['profile-modal']}>
                    <div className={styles['profile-modal-content']}>
                        <div className={styles['profile-banner']} style={{ 
                            backgroundImage: userProfile?.banner?.startsWith('/uploads/') 
                                ? `url(${BASE_URL}${userProfile.banner})` 
                                : (userProfile?.banner?.startsWith('http') ? `url(${userProfile.banner})` : 'none'),
                            backgroundColor: userProfile?.banner?.startsWith('#') 
                                ? userProfile.banner 
                                : (userProfile?.banner ? 'transparent' : userProfile?.avatarColor || '#5865F2'),
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}>
                            <button className={styles['close-button-profile']} onClick={toggleProfile}>×</button>
                            
                            <div className={styles['profile-avatar-large-container']}>
                                <div 
                                    className={styles['profile-avatar-large']} 
                                    style={{ 
                                        backgroundColor: userProfile?.avatarColor || '#5865F2',
                                        position: 'relative'
                                    }}
                                    onClick={() => setShowAvatarEditor(true)}
                                >
                                    {userProfile?.avatar ? (
                                        <img 
                                            src={userProfile.avatar.startsWith('http') ? userProfile.avatar : `${BASE_URL}${userProfile.avatar}`} 
                                            alt="User avatar" 
                                            className={styles['avatar-image-large']} 
                                        />
                                    ) : (
                                        username.charAt(0).toUpperCase()
                                    )}
                                    <div className={styles['avatar-edit-overlay']}>
                                        <span>Изменить</span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                className={styles['edit-banner-button']}
                                onClick={() => setShowBannerEditor(true)}
                            >
                                Изменить баннер
                            </button>
                        </div>

                        {showAvatarEditor && (
                            <div className={styles['avatar-editor']}>
                                <h3>Редактирование аватарки</h3>
                                <div className={styles['avatar-options']}>
                                    <div className={styles['image-option']}>
                                        <input
                                            type="file"
                                            ref={avatarFileInputRef}
                                            style={{ display: 'none' }}
                                            onChange={handleAvatarFileUpload}
                                            accept="image/*"
                                        />
                                        <button 
                                            onClick={() => avatarFileInputRef.current.click()}
                                            className={styles['upload-button']}
                                        >
                                            Загрузить фото
                                        </button>
                                        {avatarInput && (
                                            <div className={styles['avatar-preview']}>
                                                <img 
                                                    src={avatarInput} 
                                                    alt="Preview" 
                                                    style={{ 
                                                        width: '100px', 
                                                        height: '100px',
                                                        borderRadius: '50%',
                                                        objectFit: 'cover'
                                                    }} 
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className={styles['avatar-editor-actions']}>
                                    <button onClick={updateAvatar}>Сохранить</button>
                                    <button onClick={() => {
                                        setShowAvatarEditor(false);
                                        setAvatarInput('');
                                    }}>Отмена</button>
                                </div>
                            </div>
                        )}

                        {showBannerEditor && (
                            <div className={styles['banner-editor']}>
                                <h3>Редактирование баннера</h3>
                                <div className={styles['banner-options']}>
                                    <div className={styles['color-option']}>
                                        <p>Использовать цвет:</p>
                                        <input 
                                            type="color" 
                                            value={bannerInput.startsWith('#') ? bannerInput : '#5865F2'}
                                            onChange={(e) => setBannerInput(e.target.value)}
                                        />
                                        <button onClick={() => setBannerInput(userProfile?.avatarColor || '#5865F2')}>
                                            Использовать цвет аватарки
                                        </button>
                                    </div>
                                    <div className={styles['image-option']}>
                                        <p>Или загрузить изображение:</p>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            style={{ display: 'none' }}
                                            onChange={handleFileUpload}
                                            accept="image/*"
                                        />
                                        <button onClick={() => fileInputRef.current.click()}>
                                            Выбрать файл
                                        </button>
                                        {(bannerInput.startsWith('http') || bannerInput.startsWith('/')) && (
                                            <div className={styles['image-preview']}>
                                                <img src={bannerInput} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100px' }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className={styles['banner-editor-actions']}>
                                    <button onClick={updateBanner}>Сохранить</button>
                                    <button onClick={() => {
                                        setShowBannerEditor(false);
                                        setBannerInput('');
                                    }}>Отмена</button>
                                </div>
                            </div>
                        )}

                        <div className={styles['profile-header']}>
                            <h2>{username}</h2>
                        </div>
                        <div className={styles['profile-body']}>
                            {userProfile?.description && (
                                <div className={styles['profile-section']}>
                                    <h3>Обо мне</h3>
                                    <p>{userProfile.description}</p>
                                </div>
                            )}
                            <div className={styles['profile-section']}>
                                <h3>Информация</h3>
                                <p>В числе участников с {new Date(userProfile?.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>
                    <div className={styles['profile-modal-overlay']} onClick={toggleProfile}></div>
                </div>
            )}

            {/* Модальное окно настроек */}
            <SettingsModal 
                isOpen={showSettings} 
                onClose={() => setShowSettings(false)} 
            />
        </>
    );
};

export default UserPanel;
