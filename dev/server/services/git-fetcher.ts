import * as fs from 'fs';
import * as https from 'https';

var octonode = require('octonode');

export class GitFetcher {

    private repo: any;
    private hookConfig: HookConfig;

    constructor(config: HookConfig) {
        this.hookConfig = config;
    }

    public handleHookEvent = (event: any, repo: any, ref: any, data: any) => {
        try {
            console.log(JSON.stringify(event, null, 2));
            console.log(JSON.stringify(repo, null, 2));
            console.log(JSON.stringify(data.repository, null, 2));

            var fullNameRepository = data.repository.full_name;

            for (let i = 0; i < this.hookConfig.actions.length; i++) {
                let repoConfig = this.hookConfig.actions[i];
                if (repoConfig.eventName == event) {
                    this.fetchFromGitHub(this.hookConfig.accessToken, data.repository.full_name, repoConfig.branch, repoConfig.fetchPath, (buffer: any) => {
                        console.log("Action complete for Event:" + event);
                    });
                }
            }

        }
        catch (ex) {
            console.log("ERROR:" + ex.message);
        }
    }

    public fetchFromGitHub = (gitHubAccessToken: any,
        repoFullName: string,
        branchName: string,
        filePath: string,
        callback: any) => {

        let client = octonode.client(gitHubAccessToken);
        if (client != null) {
            this.repo = client.repo(repoFullName);
            console.log("Trying to get: " + repoFullName + "@filePath: " + filePath);
            try {
                this.getFolder(filePath, () => {

                });
            }
            catch (err) {
                console.log(err.message);
            }
        }
    }

    private getFolder = (filePath: string, callback: any) => {
        this.repo.contents(filePath, "", (err: any, result: Array<any>) => {
            if (err) {
                console.log("ERROR:" + err.message);

                callback(null);
            }
            else {
                try {
                    console.log("Result Length:" + result.length);
                    for (let i = 0; i < result.length; i++) {
                        let file = result[i];
                        if (file.type == "file") {
                            this.saveFile(file);
                        }
                        else {
                            if (file.type == "dir") {
                                this.ensureExists(this.hookConfig.actions[0].basePath + filePath + "/" + file.name, 511, () => {
                                    this.getFolder(filePath + "/" + file.name, callback);
                                });
                            }
                        }
                    }
                    callback(null);
                }
                catch (err) {
                    console.log(err.message);

                }
            }
        });
    }

    private saveFile = (file: any) => {
        console.log("File:" + file.name);
        let request = https.get(file.download_url, (response: any) => {
            try {
                let dir = require('path').dirname(file.path);
                this.ensureExists(this.hookConfig.actions[0].basePath + dir, 511, () => {
                    console.log(JSON.stringify(file, null, 2));
                    let newFile = fs.createWriteStream(this.hookConfig.actions[0].basePath + file.path);
                    response.pipe(newFile);
                });
            }
            catch (err) {
                console.log("SaveFile Error: " + err.message);
            }
        });
    }

    private ensureExists = (path: string, mask: number, cb: any) => {
        if (typeof mask == 'function') { // allow the `mask` parameter to be optional
            cb = mask;
            mask = 511;
        }
        console.log("ensureExists: " + path);
        let controlledPaths = new Array<string>();
        let paths = path.split(
            '/' // Put each path in an array
        ).filter(
            p => p != '.' // Skip root path indicator (.)
            ).reduce((memo, item) => {
                console.log("Reduce: memo:" + memo + " item: " + item);
                // Previous item prepended to each item so we preserve realpaths
                const prevItem = memo.length > 0 ? memo[memo.length - 1]  + "/": '';

                controlledPaths.push(prevItem + item);
                return [...memo, prevItem + item];
            }, []).map(dir => {
                console.log("MAP: " + dir);
                console.log(controlledPaths);
                fs.mkdir(dir, err => {
                    if (err && err.code != 'EEXIST') throw err
                    // Delete created directory (or skipped) from controlledPath
                    controlledPaths.splice(controlledPaths.indexOf(dir), 1);
                    if (controlledPaths.length == 0) {
                        console.log("Calling back");
                        return cb();
                    }
                });
            });
    }
}
