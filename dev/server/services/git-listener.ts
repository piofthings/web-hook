import * as Http from 'http';
import * as Https from 'https';
import * as Url from 'url';
import * as querystring from 'querystring';
import { EventEmitter } from 'events';
// var EventEmitter = require('events').EventEmitter;
import * as Util from 'util';
import * as Crypto from 'crypto';
import * as express from "express";

export class GitListener extends EventEmitter {
    private config: HookConfig;
    private enableHealthcheck: boolean = false;
    private healthcheckCode: number = 204;
    private path: string = '/github/callback';
    private wildcard: boolean = false;
    private trustProxy: boolean = false;
    private callback : (event: string, repo: any, ref: any, data: any) => void;

    constructor(options: HookConfig, cb : (event: string, repo: any, ref: any, data: any) => void) {
        super();
        this.config = options;
        this.callback = cb;
    }


    private reply = (statusCode: number, res: express.Response) => {

        let message = Http.STATUS_CODES[statusCode]!=null ? Http.STATUS_CODES[statusCode].toLowerCase() + "Yada Yada Yada" : statusCode.toString();

        var headers = {
            'Content-Type': 'application/json',
            'Content-Length': JSON.stringify(message).length
        };

        //res.writeHead(statusCode, headers);
        res.send(message);
    }

    public serverHandler = (req: express.Request, res: express.Response, next: any) => {
        let data = req.body;

        let url = Url.parse(req.url, true);
        //let buffer : Array<any> = [];
        let bufferLength = 0;
        let failed = false;
        let isForm = false;
        let remoteAddress: any = "localhost";
        if (this.trustProxy !== false) {
            remoteAddress = req.headers['x-forwarded-for'];
        }
        remoteAddress = remoteAddress || req.ip || req.socket.remoteAddress;

        console.log(Util.format('received %d bytes from %s', JSON.stringify(data).length, remoteAddress));

        if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
            isForm = true;
        }

        // if (err) {
        //     console.log(Util.format('error getting secret for %s, returning 403', res.url));
        //     console.log(err.stack);
        //     return this.reply(403, res);
        // }

        if (this.config.secret) {
            let signature: string = <string>req.headers['x-hub-signature'];

            if (!signature) {
                console.log('secret configured, but missing signature, returning 403');
                return this.reply(403, res);
            }

            signature = signature.replace(/^sha1=/, '');
            var digest = Crypto.createHmac('sha1', this.config.secret).update(JSON.stringify(data)).digest('hex');

            if (signature !== digest) {
                console.log('got invalid signature, returning 403');
                res.status(403).send('got invalid signature, returning 403');
                return this.reply(403, res);
            }
            else
            {
                console.log("verified signature, proceed");
            }
        }


        // invalid json
        if (!data) {
            console.log(Util.format('received invalid data from %s, returning 400', remoteAddress));
            return this.reply(400, res);
        }

        // data.request = req;
        let event = req.headers['x-github-event'] || req.headers['x-gogs-event'] || req.headers['x-event-key'] || (req.headers['x-gitlab-event'] ? <string>req.headers['x-gitlab-event'].split(' ')[0].toLowerCase() : 'unknown');
        console.log("Event:" + event);
        console.log("Data --------------------")

        console.log(JSON.stringify(data, null, 1))
        console.log("Repository --------------------")
        console.log(JSON.stringify(data.repository, null, 1))

        //
        // // handle GitLab system hook
        // if (event !== 'system') {
        //     // invalid json
        //     if (!data.repository || !data.repository.name) {
        //         console.log(Util.format('received incomplete data from %s, returning 400', remoteAddress));
        //         return this.reply(400, res);
        //     }
        //
        //     var repo = data.repository.name;
        //     var ref = data.ref;
        //
        //     // and now we emit a bunch of data
        //     if (ref) {
        //         console.log(Util.format('got %s event on %s:%s from %s', event, repo, ref, remoteAddress));
        //     }
        //     else {
        //         console.log(Util.format('got %s event on %s from %s', event, repo, remoteAddress));
        //     }
        //     super.emit('*', event, repo, ref, data);
        //     super.emit(repo, event, ref, data);
        //     super.emit(repo + ':' + ref, event, data);
        //     super.emit(event, repo, ref, data);
        //     super.emit(event + ':' + repo, ref, data);
        //     super.emit(event + ':' + repo + ':' + ref, data);
        // } else {
        //     var type = data.event_name;
        //
        //     // invalid json
        //     if (!type) {
        //         console.log(Util.format('received incomplete data from %s, returning 400', remoteAddress));
        //         return this.reply(400, res);
        //     }
        //
        //     console.log(Util.format('got %s event of type %s from %s', event, type, remoteAddress));
        //
        //     // and now we emit a bunch of data
        //     super.emit('*', event, type, data);
        //     super.emit(type, event, data);
        // }
        //
        //res.send()
        //
        //
        // console.log(Util.format(req.method, req.url, remoteAddress));
        //
        // // 404 if the path is wrong
        // if (!this.checkUrl(url)) {
        //     console.log(Util.format('got invalid path from %s, returning 404', remoteAddress));
        //     failed = true;
        //     return this.reply(404, res);
        // }
        //
        // // 204 if healthchecks are enabled and it's a GET
        // // note that we flag the request as failed only to
        // // stop processing any further incoming request data
        if (req.method === 'GET' && this.enableHealthcheck) {
            failed = true;
            return this.reply(this.healthcheckCode, res);
        }

        // 405 if the method is wrong
        if (req.method !== 'POST') {
            console.log(Util.format('got invalid method from %s, returning 405', remoteAddress));
            failed = true;
            return this.reply(405, res);
        }

        // 400 if it's not a github, gitlab, or bitbucket event
        if (!req.headers.hasOwnProperty('x-github-event') &&
            !req.headers.hasOwnProperty('x-gitlab-event') &&
            !req.headers.hasOwnProperty('x-gogs-event') &&
            !req.headers.hasOwnProperty('x-event-key')) {
            console.log(Util.format('missing x-github-event, x-gitlab-event, x-gogs-event, or x-event-key header from %s, returning 400', remoteAddress));
            failed = true;
            return this.reply(400, res);
        }
        this.reply(200, res);
        if(this.callback != null){
            this.callback(event, data.repository, null, data);
        }
    }

    private checkUrl = (url: any) => {
        if (url.pathname === this.path) {
            return true;
        }

        if (this.wildcard && (url.pathname.indexOf(this.path + '/') === 0)) {
            return true;
        }

        return false;
    }
}
