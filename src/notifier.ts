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

    constructor(nativeId: string) {
        super(nativeId);
    }

    async sendNotification(title: string, options?: NotifierOptions, media?: MediaObject | string, icon?: MediaObject | string): Promise<void> {
        const { serverUrl, id, corner, duration, largeIcon, smallIcon, smallIconColor } = this.storageSettings.values;

        let imageUrl: string;
        if (typeof media === 'string')
            media = await mediaManager.createMediaObjectFromUrl(media as string);
        if (media)
            imageUrl = await mediaManager.convertMediaObjectToUrl(media as MediaObject, 'image/jpeg');

        if (!imageUrl.endsWith('.jpeg')) {
            imageUrl += '.jpeg';
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
            smallIconColor
        };

        try {
            const fullBody = { ...body, ...additionalProps };
            this.console.log(`Sending ${JSON.stringify(fullBody)} to ${serverUrl}`);
            const res = await axios.post(serverUrl, fullBody);

            this.console.log('Notification sent', res.data);
        } catch (e) {
            this.console.error('Error in sending notification', e);
        }
    }

    async getSettings(): Promise<Setting[]> {
        return this.storageSettings.getSettings();
    }

    async putSetting(key: string, value: SettingValue): Promise<void> {
        return this.storageSettings.putSetting(key, value);
    }
}
