import sdk, { ScryptedDeviceBase, Notifier, Settings, NotifierOptions, MediaObject, Setting, SettingValue } from '@scrypted/sdk';
import { StorageSettings, StorageSettingsDict } from '@scrypted/sdk/storage-settings';
import axios from 'axios';
import https from 'https';

type StorageSettingKeys = 'serverUrl' | 'id' | 'smallIconColor' | 'duration' | 'corner' | 'largeIcon' | 'smallIcon';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

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

        if (!serverUrl?.trim()) {
            this.console.error('Missing serverUrl setting. Cannot send notification.');
            return;
        }

        try {
            this.console.log(`Sending ${JSON.stringify(notificationData)} to ${serverUrl}`);
            const res = await axios.post(serverUrl, notificationData, {
                httpsAgent,
                timeout: 15_000,
            });
            this.console.log('Notification sent', res.data);
        } catch (e) {
            this.console.error('Error in sending notification', e);
        }
    }

    private async toBase64Image(media?: MediaObject | string): Promise<string | undefined> {
        if (!media)
            return undefined;

        if (typeof media === 'string') {
            const trimmed = media.trim();

            if (!trimmed)
                return undefined;

            // Allow passing through icons (TvOverlay supports MDI strings).
            if (trimmed.startsWith('mdi:'))
                return trimmed;

            // If already a data URL, extract base64 payload.
            if (trimmed.startsWith('data:')) {
                const commaIndex = trimmed.indexOf(',');
                if (commaIndex !== -1)
                    return trimmed.slice(commaIndex + 1);
                return undefined;
            }

            // If it's a URL, fetch it locally and encode bytes to base64.
            if (/^https?:\/\//i.test(trimmed)) {
                const res = await axios.get<ArrayBuffer>(trimmed, {
                    responseType: 'arraybuffer',
                    timeout: 15_000,
                    httpsAgent,
                });
                return Buffer.from(res.data).toString('base64');
            }

            // Otherwise, assume caller provided an already-valid TvOverlay image string.
            return trimmed;
        }

        const bufferImage = await sdk.mediaManager.convertMediaObjectToBuffer(media, 'image/jpeg');
        return bufferImage?.toString('base64');
    }

    async sendNotification(title: string, options?: NotifierOptions, media?: MediaObject | string, icon?: MediaObject | string): Promise<void> {
        const { id, corner, duration, largeIcon, smallIcon, smallIconColor } = this.storageSettings.values;

        const image = await this.toBase64Image(media);

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
