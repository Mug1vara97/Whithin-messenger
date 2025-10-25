import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, Headset, HeadsetOff } from '@mui/icons-material';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import styles from './UserPanel.module.css';

const UserPanel = ({ 
    userId, 
    username, 
    isOpen, 
    isMuted, 
    isAudioEnabled, 
    onToggleMute, 
    onToggleAudio 
}) => {
    const [userProfile, setUserProfile] = useState(null);
    const [showProfile, setShowProfile] = useState(false);
    const [showBannerEditor, setShowBannerEditor] = useState(false);
    const [bannerInput, setBannerInput] = useState('');
    const fileInputRef = useRef(null);
    const [showAvatarEditor, setShowAvatarEditor] = useState(false);
    const [avatarInput, setAvatarInput] = useState('');
    const avatarFileInputRef = useRef(null);

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
                    </div>
                    
                    <div className={styles['user-info']}>
                        <span className={styles.username}>{username}</span>
                    </div>
                    
                    <div className={styles['voice-controls']}>
                        <button
                            className={styles['voice-control-button']}
                            onClick={onToggleMute}
                            title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
                        >
                            {isMuted ? <MicOff fontSize="small" /> : <Mic fontSize="small" />}
                        </button>
                        
                        <button
                            className={styles['voice-control-button']}
                            onClick={onToggleAudio}
                            title={isAudioEnabled ? "Выключить звук" : "Включить звук"}
                        >
                            {isAudioEnabled ? <Headset fontSize="small" /> : <HeadsetOff fontSize="small" />}
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
        </>
    );
};

export default UserPanel;
