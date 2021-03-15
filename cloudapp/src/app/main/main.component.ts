import {Subscription} from 'rxjs';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {Component, OnInit, OnDestroy, NgModule} from '@angular/core';
import {HttpClientModule, HttpClient} from '@angular/common/http'
import {TranslateService} from '@ngx-translate/core';
import {
    CloudAppRestService, CloudAppEventsService, Request, HttpMethod,
    Entity, PageInfo, RestErrorResponse, AlertService, CloudAppSettingsService, EntityType
} from '@exlibris/exl-cloudapp-angular-lib';

@Component({
    selector: 'app-main',
    templateUrl: './main.component.html',
    styleUrls: ['./main.component.scss']
})
@NgModule({
    imports: [HttpClientModule, FormsModule]
})
export class MainComponent implements OnInit, OnDestroy {

    private pageLoad$: Subscription;
    pageEntities: Entity[];
    private _apiResult: any;
    hasApiResult: boolean = false;
    show: boolean = false;
    choosebt: boolean = false;
    rebuildorupdate: boolean = false;
    loading = false;
    settings: any = {
        institution: '211030',
        institutionType: 'a',
        holding: '905',
        lookupUrl: 'https://api.exldevnetwork.net.cn/proxy/cgi-bin/fetch_z311.cgi?uname=exlibris&upass=china&key=KEY',
        lookupPrefix: '',
        classificationNumber: 'd',
        titleNumber: 'e',
        callNo: 's',
    };

    constructor(private restService: CloudAppRestService,
                private eventsService: CloudAppEventsService,
                private settingsService: CloudAppSettingsService,
                private translate: TranslateService,
                private http: HttpClient,
                private alert: AlertService) {
    }

    ngOnInit() {
        this.pageLoad$ = this.eventsService.onPageLoad(this.onPageLoad);
    }

    ngOnDestroy(): void {
        this.pageLoad$.unsubscribe();
    }

    get apiResult() {
        return this._apiResult;
    }

    set apiResult(result: any) {
        this._apiResult = result;
        this.hasApiResult = result && Object.keys(result).length > 0;
    }

    onPageLoad = (pageInfo: PageInfo) => {

        this.pageEntities = pageInfo.entities;
        if ((pageInfo.entities || []).length == 1) {
            const entity = pageInfo.entities[0];
            if (entity.type === EntityType.BIB_MMS) {
                this.restService.call(entity.link).subscribe(result => {
                    this.apiResult = result
                    // this.updateBib(result)
                    this.getSettings()
                });
            }

        } else {
            this.apiResult = {};
        }
    }

    showConfig() {
        this.show = !this.show;
    }

    setSettings(value: any) {
        this.loading = true;
        this.choosebt = value;
        this.settingsService.set(this.settings).subscribe(response => this.updateBib(this.apiResult));
        // console.log(this.apiResult)
        // this.updateBib(this.apiResult)

    }

    saved() {
        this.show = !this.show;
        this.settingsService.set(this.settings).subscribe(response => console.log("saved"));
        this.alert.success(this.translate.instant('i18n.savedate'));
    }

    getSettings() {
        this.settingsService.get().subscribe(settings => {
            this.setDefaultValue(settings);

        });

    }

    updateBib(value: any) {
        let anies = value.anies[0]
        const doc = new DOMParser().parseFromString(anies, "application/xml");
        let code = "";
        let ecode = "";
        let scode = "";
        let outsubfield;
        let eoutsubfield;
        let soutsubfield;
        let datafield995;
        Array.from(doc.getElementsByTagName("datafield")).forEach(datafield => {
            //遍历查询当前馆藏字段，若有则进行更新数据，若无则重建数据
            if (this.settings.holding == datafield.getAttribute("tag")) {
                this.rebuildorupdate = true;
                // console.log(datafield)
                datafield995 = datafield;
                Array.from(datafield.getElementsByTagName("subfield")).forEach(subfield => {
                    if (this.settings.classificationNumber == subfield.getAttribute("code")) {
                        code = subfield.textContent
                        outsubfield = subfield
                        // console.log(subfield.textContent)
                    }
                    if (this.settings.titleNumber == subfield.getAttribute("code")) {
                        ecode = subfield.textContent
                        eoutsubfield = subfield
                        // console.log(subfield.textContent)
                    }
                    if (this.settings.callNo == subfield.getAttribute("code")) {
                        scode = subfield.textContent
                        soutsubfield = subfield
                        // console.log(subfield.textContent)
                    }
                });
            } else {
                this.rebuildorupdate = false;
                if ('690' == datafield.getAttribute("tag")) {
                    datafield995 = datafield.cloneNode();
                    datafield995.setAttribute("tag", this.settings.holding)
                    // console.log(datafield995)
                    Array.from(datafield.getElementsByTagName("subfield")).forEach(subfield => {
                        if ('a' == subfield.getAttribute("code")) {
                            code = subfield.textContent
                            outsubfield = subfield
                            // console.log(subfield.textContent)
                        }
                    });
                } else {
                    // console.log('111')
                    // this.alert.error(this.translate.instant('i18n.rebuilderror'));
                }
            }
        });
        if (this.choosebt && !this.rebuildorupdate) {
            this.loading = false;
            this.alert.error(this.translate.instant('i18n.rebuildorupdateerrortip'));
        } else {
            if (this.choosebt) {
                let seq;
                outsubfield.textContent = code.split("/")[0]
                this.fetch_z311(code).then((res: any) => {
                    seq = res.seq
                    if (!eoutsubfield) {
                        if (datafield995 && seq) {
                            const template = `<subfield code=${this.settings.titleNumber}>${seq}</subfield>`;
                            let tempNode = document.createElementNS('', 'div');
                            tempNode.innerHTML = template;
                            let frag = tempNode.firstChild;
                            datafield995.appendChild(frag)
                        }
                    } else {
                        if (seq) {
                            eoutsubfield.textContent = seq;

                        }
                    }

                    // datafield995.removeChild(eoutsubfield)
                    // datafield995.removeChild(soutsubfield)

                    if (!soutsubfield) {
                        if (datafield995 && code && seq) {
                            const template = `<subfield code=${this.settings.callNo}>${code}/${seq}</subfield>`;
                            let tempNode = document.createElementNS("", 'div');
                            tempNode.innerHTML = template;
                            let frag = tempNode.firstChild;
                            datafield995.appendChild(frag)
                        }
                    } else {
                        if (code && seq) {
                            soutsubfield.textContent = `${code}/${seq}`
                        }
                    }
                    this.sortlist(datafield995)
                    // console.log(datafield995)

                    value.anies[0] = new XMLSerializer().serializeToString(doc.documentElement);

                    // console.log(value)
                    this.updateAnies(value.anies[0]);
                })
            } else {
                if (!code) {
                    this.loading = false;
                    this.alert.error(this.translate.instant('i18n.rebuilderror'));
                }
                // let seq = "7"
                let seq;
                outsubfield.textContent = code.split("/")[0]
                this.fetch_z311(code).then((res: any) => {
                    datafield995.innerHTML = '';
                    if (this.settings.institution != '' && this.settings.institutionType != '') {
                        const template = `<subfield code=${this.settings.institutionType}>${this.settings.institution}</subfield>`;
                        let tempNode = document.createElementNS("", 'div');
                        tempNode.innerHTML = template;
                        let frag = tempNode.firstChild;
                        datafield995.appendChild(frag)
                    }

                    if (code) {
                        const template = `<subfield code=${this.settings.classificationNumber}>${code}</subfield>`;
                        let tempNode = document.createElementNS('', 'div');
                        tempNode.innerHTML = template;
                        let frag = tempNode.firstChild;
                        datafield995.appendChild(frag)
                    }


                    seq = res.seq
                    // if(!eoutsubfield) {
                    if (datafield995 && seq) {
                        const template = `<subfield code=${this.settings.titleNumber}>${seq}</subfield>`;
                        let tempNode = document.createElementNS('', 'div');
                        tempNode.innerHTML = template;
                        let frag = tempNode.firstChild;
                        datafield995.appendChild(frag)
                    }

                    if (datafield995 && code && seq) {
                        const template = `<subfield code=${this.settings.callNo}>${code}/${seq}</subfield>`;
                        let tempNode = document.createElementNS("", 'div');
                        tempNode.innerHTML = template;
                        let frag = tempNode.firstChild;
                        datafield995.appendChild(frag)
                    }

                    this.sortlist(datafield995)

                    if (!this.choosebt) {
                        doc.documentElement.appendChild(datafield995);
                    }
                    // doc.documentElement.removeChild(datafield995);
                    value.anies[0] = new XMLSerializer().serializeToString(doc.documentElement);

                    // console.log(value)
                    this.updateAnies(value.anies[0]);
                })
            }

        }
    }

    sortlist(value: any) {
        var new_list_child = value.children;

        new_list_child = Array.prototype.slice.call(new_list_child).sort(function (a, b) {
            let aCode = a.getAttribute("code")
            let bCode = b.getAttribute("code")
            return aCode > bCode ? 1 : -1;
        })
        new_list_child.forEach(function (el) {
            value.appendChild(el);
        })
    }

    fetch_z311(key: string) {
        return new Promise((resolve, reject) => {
            // this.http.get(this.settings.lookupUrl.replace("KEY", key), {
            //     headers: {
            //         'X-Proxy-Host': 'http://aleph20.exlibris.com.cn:8992',
            //         'Authorization': 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJFeGxDbG91ZEFwcDohfmV4bGlicmlzZ3JvdXAvYWxtYS1zY2hlZHVsZXIiLCJzdWIiOiJqb3NodyIsImluc3RfY29kZSI6IlRSX0lOVEVHUkFUSU9OX0lOU1QiLCJ1cmxzIjp7ImFsbWEiOiJodHRwczovL2xvY2FsaG9zdDo0MjAxLyJ9LCJleHAiOjE2MTI3MDM4OTh9.ShNF9FLMJzF5IZEClL1P0QjtSNo57WH0ZY4yQKKzxhl0l93tNxQFxQa-m2E1EX9AjmFNb5-v98yOhCmLM1wNewelxcd2uIAxhvMNoQFl3tQr8Iq7Jt5KyaN6iG2w8gMSxRwj2OQ8xeTqpZM2dnDZKEJMCd3397quExzjLSbYInf4MgFQKyw4i532S7L3rEVg2oQt72_qJnZboULci027oZsfIg9MshkyoCiIw04fcV26jC8JD-pRRNrs3qqfFCyAnlbIBt_oXr32BTTebg1IzNT41ezCf77FyBMY0oKVFzeisn-Jo2iSIxRBjJ8nrgqsvG8XgxbwCwFevnU-hHZIZQ'
            //     }
            // }).subscribe(function (data) {
            //     this.loading = false;
            //     console.log(data)
            //     resolve(data)
            // }, error => {
            //     this.loading = false;
            //     this.alert.error(this.translate.instant('i18n.error', {url: this.settings.lookupUrl}));
            //     reject(error)
            // })
            resolve({seq: 7})
        })

    }

    updateAnies(anies: string) {
        let request: Request = {
            url: this.pageEntities[0].link,
            method: HttpMethod.PUT,
            headers: {
                "Content-Type": "application/xml",
                Accept: "application/json"
            },
            requestBody: `<bib>${anies}</bib>`,
        };
        this.restService.call(request).subscribe({
            next: result => {
                this.loading = false;
                this.refreshPage();
                this.alert.success(this.translate.instant('i18n.successupdate'));
            },
            error: (e: RestErrorResponse) => {
                this.alert.error(this.translate.instant('i18n.errorupdate'));
                // console.error(e);
                this.loading = false;
            }
        });
    }

    update(value: any) {
        this.loading = true;
        console.log(value)
        let requestBody = this.tryParseJson(value);
        if (!requestBody) {
            this.loading = false;
            return this.alert.error(this.translate.instant('i18n.errorjson'));
        }
        this.sendUpdateRequest(requestBody);
    }

    refreshPage = () => {
        this.loading = true;
        this.eventsService.refreshPage().subscribe({
            next: () => this.alert.success('Success!'),
            error: e => {
                // console.error(e);
                this.alert.error(this.translate.instant('i18n.errorrefreshpage'));
            },
            complete: () => this.loading = false
        });
    }

    private getData() {
        // let request: Request = {
        //   url: '/proxy/cgi-bin/fetch_z311.cgi?uname=exlibris&upass=china&key=TP312/001',
        //   method: HttpMethod.GET,
        //   headers:{
        //     'X-Proxy-Host':'http://aleph20.exlibris.com.cn:8992'
        //   }
        // };
        // this.restService.call(request).subscribe({
        //   next: result => {
        //     console.log(result)
        //   },
        //   error: (e: RestErrorResponse) => {
        //     this.alert.error('Failed to update data');
        //     console.error(e);
        //     this.loading = false;
        //   }
        // });
        this.http.get('/proxy/cgi-bin/fetch_z311.cgi?uname=exlibris&upass=china&key=TP312/001', {
            headers: {
                'X-Proxy-Host': 'http://aleph20.exlibris.com.cn:8992'
            }
        }).subscribe(function (data) {
            console.log(data)
        })
        // let request: Request = {
        //   url: 'http://222.128.60.220:8992/cgi-bin/fetch_z311.cgi?uname=exlibris&upass=china&key=TP312/001',
        //   method: HttpMethod.GET
        // };
        // this.restService.call(request).subscribe({
        //   next: result => {
        //     console.log(result)
        //     // this.apiResult = result;
        //     // this.refreshPage();
        //   },
        //   error: (e: RestErrorResponse) => {
        //     this.alert.error('Failed to update data');
        //     console.error(e);
        //     this.loading = false;
        //   }
        // });
    }

    private sendUpdateRequest(requestBody: any) {
        let request: Request = {
            url: this.pageEntities[0].link,
            method: HttpMethod.PUT,
            requestBody
        };
        this.restService.call(request).subscribe({
            next: result => {
                this.apiResult = result;
                this.refreshPage();
            },
            error: (e: RestErrorResponse) => {
                this.alert.error(this.translate.instant('i18n.errorupdate'));
                console.error(e);
                this.loading = false;
            }
        });
    }

    private tryParseJson(value: any) {
        try {
            return JSON.parse(value);
        } catch (e) {
            console.error(e);
        }
        return undefined;
    }

    setDefaultValue(settings: any) {
        if (settings.institution) {
            this.settings.institution = settings.institution
        } else {
            this.settings.institution = '211030'
        }
        if (settings.institutionType) {
            this.settings.institutionType = settings.institutionType
        } else {
            this.settings.institutionType = 'a'
        }
        if (settings.holding) {
            this.settings.holding = settings.holding
        } else {
            this.settings.holding = '905'
        }
        if (settings.lookupUrl) {
            this.settings.lookupUrl = settings.lookupUrl
        } else {
            this.settings.lookupUrl = 'https://api.exldevnetwork.net.cn/proxy/cgi-bin/fetch_z311.cgi?uname=exlibris&upass=china&key=KEY'
        }
        if (settings.lookupPrefix) {
            this.settings.lookupPrefix = settings.lookupPrefix
        } else {
            this.settings.lookupPrefix = ''
        }
        if (settings.classificationNumber) {
            this.settings.classificationNumber = settings.classificationNumber
        } else {
            this.settings.classificationNumber = 'd'
        }
        if (settings.titleNumber) {
            this.settings.titleNumber = settings.titleNumber
        } else {
            this.settings.titleNumber = 'e'
        }
        if (settings.callNo) {
            this.settings.callNo = settings.callNo
        } else {
            this.settings.callNo = 's'
        }
    }

}
