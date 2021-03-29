import {Subscription} from 'rxjs';
import {FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {Component, OnInit, OnDestroy, NgModule} from '@angular/core';
import {HttpClientModule, HttpClient} from '@angular/common/http'
import {TranslateService} from '@ngx-translate/core';
import {
    CloudAppRestService, CloudAppEventsService, Request, HttpMethod,
    Entity, PageInfo, RestErrorResponse, AlertService, CloudAppSettingsService, EntityType, FormGroupUtil
} from '@exlibris/exl-cloudapp-angular-lib';
import {Settings} from '../models/settings';

@Component({
    selector: 'app-main',
    templateUrl: './main.component.html',
    styleUrls: ['./main.component.scss']
})
@NgModule({
    imports: [HttpClientModule, FormsModule]
})
export class MainComponent implements OnInit, OnDestroy {

    form: FormGroup;
    // saving = false;

    private pageLoad$: Subscription;
    pageEntities: Entity[];
    private _apiResult: any;
    private name: String = '';
    hasApiResult: boolean = false;
    show: boolean = false;
    choosebt: boolean = false;
    rebuildorupdate: boolean = false;
    loading = false;
    // settings: any = {
    //     institution: '211030',
    //     institutionType: 'a',
    //     holding: '905',
    //     lookupUrl: '/proxy/cgi-bin/fetch_z311.cgi?uname=exlibris&upass=china&key=KEY',
    //     lookupPrefix: '',
    //     classificationNumber: 'd',
    //     titleNumber: 'e',
    //     callNo: 's',
    //     subfieldsize: '0'
    // };

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
        // this.settings = this.form.value
        // this.settingsService.set(this.form.value).subscribe(response => this.updateBib(this.apiResult));
        // console.log(this.apiResult)
        // this.updateBib(this.apiResult)

        this.settingsService.set(this.form.value).subscribe(
            response => {
                // this.alert.success('Settings successfully saved.');
                this.form.markAsPristine();
                this.updateBib(this.apiResult)
            },
            // err => this.alert.error(err.message),
            // ()  => this.saving = false
        );

    }

    saved() {
        // this.settings = this.form.value

        if (this.form.value.holding && this.form.value.classificationNumber && this.form.value.titleNumber && this.form.value.callNo) {
            this.show = !this.show;
            this.settingsService.set(this.form.value).subscribe(response =>
                    response => {
                        // console.log("Saved")
                        this.form.markAsPristine();
                    },
                err => this.alert.error(err.message,{autoClose:true,delay:3000}),
                // () => this.saving = false
            );
            this.alert.success(this.translate.instant('i18n.savedate'));
        } else {
            this.alert.error(this.translate.instant('i18n.errortip'),{autoClose:true,delay:3000});
            this.setDefaultValue(this.form.value);
        }
    }

    getSettings() {
        this.settingsService.get().subscribe(settings => {
            // this.settings = settings as Settings;
            // this.setDefaultValue(settings);
            this.form = FormGroupUtil.toFormGroup(Object.assign(new Settings(), settings))
            // this.form.value = settings as Settings;
            console.log(this.form)
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
            if (this.form.value.holding == datafield.getAttribute("tag")) {
                this.rebuildorupdate = true;
                // console.log(datafield)
                datafield995 = datafield;
                Array.from(datafield.getElementsByTagName("subfield")).forEach(subfield => {
                    if (this.form.value.classificationNumber == subfield.getAttribute("code")) {
                        code = subfield.textContent
                        outsubfield = subfield
                        // console.log(subfield.textContent)
                    }
                    if (this.form.value.titleNumber == subfield.getAttribute("code")) {
                        ecode = subfield.textContent
                        eoutsubfield = subfield
                        // console.log(subfield.textContent)
                    }
                    if (this.form.value.callNo == subfield.getAttribute("code")) {
                        scode = subfield.textContent
                        soutsubfield = subfield
                        // console.log(subfield.textContent)
                    }
                });
            } else {
                this.rebuildorupdate = false;
                if ('690' == datafield.getAttribute("tag")) {
                    datafield995 = datafield.cloneNode();
                    datafield995.setAttribute("tag", this.form.value.holding)
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
            // this.loading = false;
            // this.alert.error(this.translate.instant('i18n.rebuildorupdateerrortip'),{autoClose:true,delay:3000});
            if (!code) {
                this.loading = false;
                this.alert.error(this.translate.instant('i18n.rebuilderror'),{autoClose:true,delay:3000});
            }
            // let seq = "7"
            let seq;
            outsubfield.textContent = code.split("/")[0]
            this.fetch_z311(code).then((res: any) => {
                datafield995.innerHTML = '';
                if (this.form.value.institution != '' && this.form.value.institutionType != '') {
                    const template = `<subfield code=${this.form.value.institutionType}>${this.form.value.institution}</subfield>`;
                    let tempNode = document.createElementNS("", 'div');
                    tempNode.innerHTML = template;
                    let frag = tempNode.firstChild;
                    datafield995.appendChild(frag)
                }

                if (code) {
                    const template = `<subfield code=${this.form.value.classificationNumber}>${code}</subfield>`;
                    let tempNode = document.createElementNS('', 'div');
                    tempNode.innerHTML = template;
                    let frag = tempNode.firstChild;
                    datafield995.appendChild(frag)
                }

                seq = this.repair(res.seq)

                // if(!eoutsubfield) {
                if (datafield995 && seq) {
                    const template = `<subfield code=${this.form.value.titleNumber}>${seq}</subfield>`;
                    let tempNode = document.createElementNS('', 'div');
                    tempNode.innerHTML = template;
                    let frag = tempNode.firstChild;
                    datafield995.appendChild(frag)
                }

                if (datafield995 && code && seq) {
                    const template = `<subfield code=${this.form.value.callNo}>${code}/${seq}</subfield>`;
                    let tempNode = document.createElementNS("", 'div');
                    tempNode.innerHTML = template;
                    let frag = tempNode.firstChild;
                    datafield995.appendChild(frag)
                }

                this.sortlist(datafield995)

                if (this.choosebt) {
                    doc.documentElement.appendChild(datafield995);
                }
                // doc.documentElement.removeChild(datafield995);
                value.anies[0] = new XMLSerializer().serializeToString(doc.documentElement);

                // console.log(value)
                if (this.form.value.holding && this.form.value.classificationNumber && this.form.value.titleNumber && this.form.value.callNo) {
                    this.updateAnies(value.anies[0]);
                } else {
                    this.loading = false;
                    this.alert.error(this.translate.instant('i18n.errortip'),{autoClose:true,delay:3000});
                    this.setDefaultValue(this.form.value);
                }

            })
        } else {
            if (this.choosebt) {
                let seq;
                outsubfield.textContent = code.split("/")[0]
                if (!eoutsubfield || !ecode) {
                    this.fetch_z311(code).then((res: any) => {
                        seq = this.repair(res.seq)
                        if (datafield995 && seq) {
                            const template = `<subfield code=${this.form.value.titleNumber}>${seq}</subfield>`;
                            let tempNode = document.createElementNS('', 'div');
                            tempNode.innerHTML = template;
                            let frag = tempNode.firstChild;
                            datafield995.appendChild(frag)
                        }

                        // datafield995.removeChild(eoutsubfield)
                        // datafield995.removeChild(soutsubfield)

                        if (!soutsubfield) {
                            if (datafield995 && code && seq) {
                                const template = `<subfield code=${this.form.value.callNo}>${code}/${seq}</subfield>`;
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
                        if (this.form.value.holding && this.form.value.classificationNumber && this.form.value.titleNumber && this.form.value.callNo) {
                            this.updateAnies(value.anies[0]);
                        } else {
                            this.loading = false;
                            this.alert.error(this.translate.instant('i18n.errortip'),{autoClose:true,delay:3000});
                            this.setDefaultValue(this.form.value);
                        }
                    })
                } else {
                    eoutsubfield.textContent = `${ecode}`;

                    if (!soutsubfield) {
                        if (datafield995 && code && ecode) {
                            const template = `<subfield code=${this.form.value.callNo}>${code}/${ecode}</subfield>`;
                            let tempNode = document.createElementNS("", 'div');
                            tempNode.innerHTML = template;
                            let frag = tempNode.firstChild;
                            datafield995.appendChild(frag)
                        }
                    } else {
                        if (code && ecode) {
                            soutsubfield.textContent = `${code}/${ecode}`
                        }
                    }
                    this.sortlist(datafield995)

                    value.anies[0] = new XMLSerializer().serializeToString(doc.documentElement);

                    if (this.form.value.holding && this.form.value.classificationNumber && this.form.value.titleNumber && this.form.value.callNo) {
                        this.updateAnies(value.anies[0]);
                    } else {
                        this.loading = false;
                        this.alert.error(this.translate.instant('i18n.errortip'),{autoClose:true,delay:3000});
                        this.setDefaultValue(this.form.value);
                    }
                }

                // this.fetch_z311(code).then((res: any) => {
                //     seq = res.seq
                //     if (!eoutsubfield) {
                //         if (datafield995 && seq) {
                //             const template = `<subfield code=${this.settings.titleNumber}>${seq}</subfield>`;
                //             let tempNode = document.createElementNS('', 'div');
                //             tempNode.innerHTML = template;
                //             let frag = tempNode.firstChild;
                //             datafield995.appendChild(frag)
                //         }
                //     } else {
                //         if (seq) {
                //             eoutsubfield.textContent = seq;
                //
                //         }
                //     }
                //
                //     // datafield995.removeChild(eoutsubfield)
                //     // datafield995.removeChild(soutsubfield)
                //
                //     if (!soutsubfield) {
                //         if (datafield995 && code && seq) {
                //             const template = `<subfield code=${this.settings.callNo}>${code}/${seq}</subfield>`;
                //             let tempNode = document.createElementNS("", 'div');
                //             tempNode.innerHTML = template;
                //             let frag = tempNode.firstChild;
                //             datafield995.appendChild(frag)
                //         }
                //     } else {
                //         if (code && seq) {
                //             soutsubfield.textContent = `${code}/${seq}`
                //         }
                //     }
                //     this.sortlist(datafield995)
                //     // console.log(datafield995)
                //
                //     value.anies[0] = new XMLSerializer().serializeToString(doc.documentElement);
                //
                //     // console.log(value)
                //     if( this.settings.holding && this.settings.classificationNumber && this.settings.titleNumber && this.settings.callNo){
                //         this.updateAnies(value.anies[0]);
                //     }else{
                //         this.loading = false;
                //         this.alert.error(this.translate.instant('i18n.errortip'));
                //         this.setDefaultValue(this.settings);
                //     }
                // })

            } else {
                if (!code) {
                    this.loading = false;
                    this.alert.error(this.translate.instant('i18n.rebuilderror'),{autoClose:true,delay:3000});
                }
                // let seq = "7"
                let seq;
                outsubfield.textContent = code.split("/")[0]
                this.fetch_z311(code).then((res: any) => {
                    datafield995.innerHTML = '';
                    if (this.form.value.institution != '' && this.form.value.institutionType != '') {
                        const template = `<subfield code=${this.form.value.institutionType}>${this.form.value.institution}</subfield>`;
                        let tempNode = document.createElementNS("", 'div');
                        tempNode.innerHTML = template;
                        let frag = tempNode.firstChild;
                        datafield995.appendChild(frag)
                    }

                    if (code) {
                        const template = `<subfield code=${this.form.value.classificationNumber}>${code}</subfield>`;
                        let tempNode = document.createElementNS('', 'div');
                        tempNode.innerHTML = template;
                        let frag = tempNode.firstChild;
                        datafield995.appendChild(frag)
                    }

                    seq = this.repair(res.seq)

                    // if(!eoutsubfield) {
                    if (datafield995 && seq) {
                        const template = `<subfield code=${this.form.value.titleNumber}>${seq}</subfield>`;
                        let tempNode = document.createElementNS('', 'div');
                        tempNode.innerHTML = template;
                        let frag = tempNode.firstChild;
                        datafield995.appendChild(frag)
                    }

                    if (datafield995 && code && seq) {
                        const template = `<subfield code=${this.form.value.callNo}>${code}/${seq}</subfield>`;
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
                    if (this.form.value.holding && this.form.value.classificationNumber && this.form.value.titleNumber && this.form.value.callNo) {
                        this.updateAnies(value.anies[0]);
                    } else {
                        this.loading = false;
                        this.alert.error(this.translate.instant('i18n.errortip'),{autoClose:true,delay:3000});
                        this.setDefaultValue(this.form.value);
                    }

                })
            }

        }
    }
    repair(value:any){
        let i = 1;
        let zero = '0';
        if(value.toString().length<this.form.value.subfieldsize){
            while (i < this.form.value.subfieldsize - value.toString().length) {
                zero = zero + '0';
                i++;
            }
            value = zero + value
        }
        return value;
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
            this.eventsService.getAuthToken().subscribe(
                data => {
                    // console.log(data)
                    this.http.get("https://api.exldevnetwork.net.cn" + this.form.value.lookupUrl.replace("KEY", key), {
                        headers: {
                            'X-Proxy-Host': 'http://aleph20.exlibris.com.cn:8992',
                            'Authorization': 'Bearer ' + data
                        }
                    }).subscribe(function (data) {
                        this.loading = false;
                        // console.log(data)
                        resolve(data)
                    }, error => {
                        this.loading = false;
                        this.alert.error(this.translate.instant('i18n.error', {url: "https://api.exldevnetwork.net.cn" + this.form.value.lookupUrl.replace("KEY", key)}));
                        reject(error)
                    })
                }
            );

            // resolve({seq:"7"})
            // resolve({seq:Math.ceil(Math.random()*99)})
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
                // this.alert.success(this.translate.instant('i18n.successupdate'));
            },
            error: (e: RestErrorResponse) => {
                this.alert.error(this.translate.instant('i18n.errorupdate'),{autoClose:true,delay:3000});
                // console.error(e);
                this.loading = false;
            }
        });
    }

    // update(value: any) {
    //     this.loading = true;
    //     console.log(value)
    //     let requestBody = this.tryParseJson(value);
    //     if (!requestBody) {
    //         this.loading = false;
    //         return this.alert.error(this.translate.instant('i18n.errorjson'),{autoClose:true,delay:3000});
    //     }
    //     this.sendUpdateRequest(requestBody);
    // }

    refreshPage = () => {
        this.loading = true;
        this.eventsService.refreshPage().subscribe({
            next: () => this.alert.success('Success!'),
            error: e => {
                // console.error(e);
                this.alert.error(this.translate.instant('i18n.errorrefreshpage'),{autoClose:true,delay:3000});
            },
            complete: () => this.loading = false
        });
    }

    // private getData() {
    //     // let request: Request = {
    //     //   url: '/proxy/cgi-bin/fetch_z311.cgi?uname=exlibris&upass=china&key=TP312/001',
    //     //   method: HttpMethod.GET,
    //     //   headers:{
    //     //     'X-Proxy-Host':'http://aleph20.exlibris.com.cn:8992'
    //     //   }
    //     // };
    //     // this.restService.call(request).subscribe({
    //     //   next: result => {
    //     //     console.log(result)
    //     //   },
    //     //   error: (e: RestErrorResponse) => {
    //     //     this.alert.error('Failed to update data');
    //     //     console.error(e);
    //     //     this.loading = false;
    //     //   }
    //     // });
    //     this.http.get('/proxy/cgi-bin/fetch_z311.cgi?uname=exlibris&upass=china&key=TP312/001', {
    //         headers: {
    //             'X-Proxy-Host': 'http://aleph20.exlibris.com.cn:8992'
    //         }
    //     }).subscribe(function (data) {
    //         console.log(data)
    //     })
    //     // let request: Request = {
    //     //   url: 'http://222.128.60.220:8992/cgi-bin/fetch_z311.cgi?uname=exlibris&upass=china&key=TP312/001',
    //     //   method: HttpMethod.GET
    //     // };
    //     // this.restService.call(request).subscribe({
    //     //   next: result => {
    //     //     console.log(result)
    //     //     // this.apiResult = result;
    //     //     // this.refreshPage();
    //     //   },
    //     //   error: (e: RestErrorResponse) => {
    //     //     this.alert.error('Failed to update data');
    //     //     console.error(e);
    //     //     this.loading = false;
    //     //   }
    //     // });
    // }

    // private tryParseJson(value: any) {
    //     try {
    //         return JSON.parse(value);
    //     } catch (e) {
    //         console.error(e);
    //     }
    //     return undefined;
    // }

    setDefaultValue(settings: any) {
        if (settings.institution) {
            this.form.value.institution = settings.institution
        } else {
            this.form.value.institution = '211030'
        }
        if (settings.institutionType) {
            this.form.value.institutionType = settings.institutionType
        } else {
            this.form.value.institutionType = 'a'
        }
        if (settings.holding) {
            this.form.value.holding = settings.holding
        } else {
            this.form.value.holding = '905'
        }
        if (settings.lookupUrl) {
            this.form.value.lookupUrl = settings.lookupUrl
        } else {
            this.form.value.lookupUrl = '/proxy/cgi-bin/fetch_z311.cgi?uname=exlibris&upass=china&key=KEY'
        }
        if (settings.lookupPrefix) {
            this.form.value.lookupPrefix = settings.lookupPrefix
        } else {
            this.form.value.lookupPrefix = ''
        }
        if (settings.classificationNumber) {
            this.form.value.classificationNumber = settings.classificationNumber
        } else {
            this.form.value.classificationNumber = 'd'
        }
        if (settings.titleNumber) {
            this.form.value.titleNumber = settings.titleNumber
        } else {
            this.form.value.titleNumber = 'e'
        }
        if (settings.callNo) {
            this.form.value.callNo = settings.callNo
        } else {
            this.form.value.callNo = 's'
        }
        if (settings.subfieldsize) {
            this.form.value.subfieldsize = settings.subfieldsize
        } else {
            this.form.value.subfieldsize = '0'
        }
    }

}
