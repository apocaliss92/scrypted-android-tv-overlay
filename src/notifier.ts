import sdk, { ScryptedDeviceBase, Notifier, Settings, NotifierOptions, MediaObject, Setting, SettingValue } from '@scrypted/sdk';
import { StorageSettings, StorageSettingsDict } from '@scrypted/sdk/storage-settings';
import axios from 'axios';
const { mediaManager } = sdk;

type StorageSettingKeys = 'serverUrl' | 'id' | 'smallIconColor' | 'duration' | 'corner' | 'largeIcon' | 'smallIcon';

export const storageSettingsDic: StorageSettingsDict<StorageSettingKeys> = {
    id: {
        title: 'Identifier',
    },
    serverUrl: {
        type: 'string',
        title: 'Server url',
        placeholder: 'http://192.168.1.1:5001/notify '
    },
    duration: {
        type: 'number',
        title: 'Notification visibility duration in seconds',
        defaultValue: 7
    },
    corner: {
        type: 'string',
        title: 'Notification position',
        defaultValue: 'bottom_end'
    },
    largeIcon: {
        type: 'string',
        title: 'Large icon',
        defaultValue: 'mdi:motion-sensor'
    },
    smallIcon: {
        type: 'string',
        title: 'Small icon',
        defaultValue: 'mdi:camera'
    },
    smallIconColor: {
        type: 'string',
        title: 'Icon color',
        defaultValue: '#049cdb'
    },
}

export class AndroidTvOverlayNotifier extends ScryptedDeviceBase implements Notifier, Settings {
    storageSettings = new StorageSettings(this, storageSettingsDic);
    queue: any[] = [];
    interval: NodeJS.Timeout;
    lastNotificationTime = 0;

    constructor(nativeId: string) {
        super(nativeId);
        this.startQueueProcessor();
    }

    private startQueueProcessor(): void {
        if (this.interval) {
            clearInterval(this.interval);
        }
        
        this.interval = setInterval(() => {
            this.processQueue();
        }, 1000);
    }

    private async processQueue(): Promise<void> {
        if (this.queue.length === 0) {
            return;
        }

        const { duration } = this.storageSettings.values;
        const now = Date.now();
        const durationMs = (duration || 7) * 1000;
        
        if (now - this.lastNotificationTime >= durationMs) {
            const notification = this.queue.shift();
            if (notification) {
                await this.sendNotificationInternal(notification);
                this.lastNotificationTime = now;
            }
        }
    }

    private async sendNotificationInternal(notificationData: any): Promise<void> {
        const { serverUrl } = this.storageSettings.values;
        
        try {
            this.console.log(`Sending ${JSON.stringify(notificationData)} to ${serverUrl}`);
            const res = await axios.post(serverUrl, notificationData);
            this.console.log('Notification sent', res.data);
        } catch (e) {
            this.console.error('Error in sending notification', e);
        }
    }

    async sendNotification(title: string, options?: NotifierOptions, media?: MediaObject | string, icon?: MediaObject | string): Promise<void> {
        const { id, corner, duration, largeIcon, smallIcon, smallIconColor } = this.storageSettings.values;

        let image: string;
        if (typeof media === 'string') {
            media = await mediaManager.createMediaObjectFromUrl(media as string);
        }

        if (media) {
            const bufferImage = await sdk.mediaManager.convertMediaObjectToBuffer(media, 'image/jpeg');
            image = bufferImage?.toString('base64');
        }

        const additionalProps = options?.data?.androidTvOverlay ?? {};

        const body: any = {
            id,
            title,
            message: options.body ?? options.bodyWithSubtitle,
            corner,
            duration,
            largeIcon,
            smallIcon,
            smallIconColor,
            image
        };

        const fullBody = { ...body, ...additionalProps };
        
        this.queue.push(fullBody);
        this.console.log(`Notification added to queue. Queue length: ${this.queue.length}`);
    }

    async getSettings(): Promise<Setting[]> {
        return this.storageSettings.getSettings();
    }

    async putSetting(key: string, value: SettingValue): Promise<void> {
        return this.storageSettings.putSetting(key, value);
    }
}
