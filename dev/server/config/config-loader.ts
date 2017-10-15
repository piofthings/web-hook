import * as nconf from "nconf";

export class ConfigLoader {
    public currentSettings: HookConfig;

    constructor() {
    }

    public load(callback: (currentSettings: HookConfig) => void): void {
        try {
            nconf.file('./webconfig.json');
            nconf.load((data) => {
                this.currentSettings = {
                    'accessToken': nconf.get('accessToken'),
                    'host': nconf.get('host'),
                    'port': nconf.get('port'),
                    'route': nconf.get('route'),
                    'secret': nconf.get('secret'),
                    'actions': nconf.get('actions') ? nconf.get('actions') : []
                }
                if (callback != null) {
                    callback(this.currentSettings);
                }
            });
        }
        catch (error) {
            console.log(error);
        }
    }
}
