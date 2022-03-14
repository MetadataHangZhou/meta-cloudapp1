import {Subscription} from 'rxjs';
import {FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {Component, OnInit, OnDestroy, NgModule} from '@angular/core';
import {HttpClientModule, HttpClient} from '@angular/common/http'
import {TranslateService} from '@ngx-translate/core';
import {
    CloudAppRestService, CloudAppEventsService, Request, HttpMethod,
    Entity, PageInfo, RestErrorResponse, AlertService, CloudAppSettingsService, EntityType, FormGroupUtil
} from '@exlibris/exl-cloudapp-angular-lib';
import {Cnmarc} from '../models/cnmarc';
import {Marc21} from "../models/marc21";

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
    form21:FormGroup;

    private pageLoad$: Subscription;
    pageEntities: Entity[];
    private _apiResult: any;
    private name: String = '';
    hasApiResult: boolean = false;
    show: boolean = false;
    choosebt: boolean = false; //the judege button is 'Update' or 'Rebuild'
    rebuildorupdate: boolean = false;
    loading = false;
    models:any = {
        cnmarc:{
            institution:'',
            institutionType:'a',
            classification:'690',
            holding: '905',
            lookupUrl: '/proxy/cgi-bin/fetch_z311.cgi?uname=proquest&upass=L0china&key=KEY',
            lookupPrefix:'',
            classificationNumber: 'd',
            titleNumber: 'e',
            callNo: 's',
            subfieldsize: '0'
        },
        marc21:{
            institution:'',
            institutionType:'a',
            classification:'690',
            holding: '090',
            lookupUrl: '/proxy/cgi-bin/fetch_z311.cgi?uname=proquest&upass=L0china&key=KEY',
            lookupPrefix:'',
            classificationNumber: 'd',
            titleNumber: 'u',
            callNo: 's',
            subfieldsize: '0'
        }
    }

    constructor(private restService: CloudAppRestService,
                private eventsService: CloudAppEventsService,
                private settingsService: CloudAppSettingsService,
                private translate: TranslateService,
                private http: HttpClient,
                private alert: AlertService) {

    }

    ngOnInit() {
        this.pageLoad$ = this.eventsService.onPageLoad(this.onPageLoad);
        //检测窗口大小
        // window.onresize = ()=>{
        //     if(window.innerWidth > 450){
        //         console.log( 'onresize:11')
        //     }else{
        //         console.log( 'onresize:222')
        //     }
        // }
        this.getSettings()

        // this.getcckb('ccc').then((res: any) => {
        //     console.log(res)
        // })

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

                });
            }

        } else {
            this.apiResult = {};
        }


    }

    setSettings(value: any) {
        //the monitor button ,submit form value
        this.loading = true;
        this.choosebt = value;

        if(!this.models || !this.models.cnmarc || !this.models.marc21){
            this.alert.error(this.translate.instant('i18n.errorconfigtip'), {autoClose: true, delay: 3000});
        }else{
            this.settingsService.set(this.models).subscribe(
                response => {
                    this.form.markAsPristine();
                    this.updateBib(this.apiResult)
                },
                // err => this.alert.error(err.message),
                // ()  => this.saving = false
            );
        }
    }

    getSettings() {
        // get default form value
        this.settingsService.get().subscribe(settings => {

            if(settings){
                if(settings.cnmarc){
                    this.form = FormGroupUtil.toFormGroup(Object.assign(new Cnmarc(), settings.cnmarc))
                }else{
                    this.form = FormGroupUtil.toFormGroup(Object.assign(new Cnmarc(), this.models.cnmarc))
                }
                if(settings.marc21){
                    this.form21 = FormGroupUtil.toFormGroup(Object.assign(new Marc21(), settings.marc21))
                }else{
                    this.form21 = FormGroupUtil.toFormGroup(Object.assign(new Marc21(), this.models.marc21))
                }
            }else{
                this.form = FormGroupUtil.toFormGroup(Object.assign(new Cnmarc(), this.models.cnmarc))
                this.form21 = FormGroupUtil.toFormGroup(Object.assign(new Marc21(), this.models.marc21))
            }

            this.models.cnmarc = this.form.value
            this.models.marc21 = this.form21.value
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
        let CNor21 = 0;
        let field100='';
        // console.log(doc)

        let fieldldr = doc.getElementsByTagName("leader")[0].innerHTML
        Array.from(doc.getElementsByTagName("datafield")).forEach(datafield =>{
            if(datafield.getAttribute("tag") == '100'){
                Array.from(datafield.getElementsByTagName("subfield")).forEach(subfield => {
                    if ('a' == subfield.getAttribute("code")) {
                        field100 = subfield.textContent
                    }
                });

            }
        })

        if(fieldldr.substring(7,8) == 'm' && field100.substring(22,25) == 'chi'){
            //When conditions are unique, the year of publication must be carried
            this.form.value.pubyear = true;
        }else{
            this.form.value.pubyear = false;
        }
        this.form.value.year = field100.substring(9,13);


        Array.from(doc.getElementsByTagName("controlfield")).forEach(controlfield =>{
            // console.log(controlfield.getAttribute("tag"))
            if(controlfield.getAttribute("tag") == '008'){
                CNor21 = 1;
            }
        })
        // if(CNor21 = 0){
        //     Array.from(doc.getElementsByTagName("datafield")).forEach(datafield =>{
        //         // console.log(controlfield.getAttribute("tag"))
        //         if(datafield.getAttribute("tag") == '100'){
        //             CNor21 = 0;
        //         }
        //     })
        // }

        Array.from(doc.getElementsByTagName("datafield")).forEach(datafield => {
            if(CNor21 == 1){
                // console.log('1111')
                //To traverse and query the fields in the current collection, update the data if there is one, and rebuild the data if there is none
                if (this.form21.value.holding == datafield.getAttribute("tag")) {
                    this.rebuildorupdate = true;
                    datafield995 = datafield;
                    Array.from(datafield.getElementsByTagName("subfield")).forEach(subfield => {
                        if (this.form21.value.classificationNumber == subfield.getAttribute("code")) {
                            code = subfield.textContent
                            outsubfield = subfield
                        }
                        if (this.form21.value.titleNumber == subfield.getAttribute("code")) {
                            ecode = subfield.textContent
                            eoutsubfield = subfield
                        }
                        if (this.form21.value.callNo == subfield.getAttribute("code")) {
                            scode = subfield.textContent
                            soutsubfield = subfield
                        }
                    });
                } else {
                    this.rebuildorupdate = false;
                    if (this.form21.value.classification.substring(0,3) == datafield.getAttribute("tag") && !code) {
                        datafield995 = datafield.cloneNode();
                        datafield995.setAttribute("tag", this.form21.value.holding)
                        Array.from(datafield.getElementsByTagName("subfield")).forEach(subfield => {
                            if (this.form21.value.classification.substring(3,4) == subfield.getAttribute("code")) {
                                code = subfield.textContent
                                outsubfield = subfield
                            }
                        });
                    }
                }
            }else if(CNor21 == 0){
                // console.log('000')
                //To traverse and query the fields in the current collection, update the data if there is one, and rebuild the data if there is none
                if (this.form.value.holding == datafield.getAttribute("tag")) {
                    this.rebuildorupdate = true;
                    datafield995 = datafield;
                    Array.from(datafield.getElementsByTagName("subfield")).forEach(subfield => {
                        if (this.form.value.classificationNumber == subfield.getAttribute("code")) {
                            code = subfield.textContent
                            outsubfield = subfield
                        }
                        if (this.form.value.titleNumber == subfield.getAttribute("code")) {
                            ecode = subfield.textContent
                            eoutsubfield = subfield
                        }
                        if (this.form.value.callNo == subfield.getAttribute("code")) {
                            scode = subfield.textContent
                            soutsubfield = subfield
                        }
                    });
                } else {
                    this.rebuildorupdate = false;
                    if (this.form.value.classification.substring(0,3) == datafield.getAttribute("tag") && !code) {
                        datafield995 = datafield.cloneNode();
                        datafield995.setAttribute("tag", this.form.value.holding)
                        Array.from(datafield.getElementsByTagName("subfield")).forEach(subfield => {
                            if (this.form.value.classification.substring(3,4) == subfield.getAttribute("code")) {
                                code = subfield.textContent
                                outsubfield = subfield
                            }
                        });
                    }
                }
            }
        });

        if(CNor21 == 0){
            if (this.choosebt && !this.rebuildorupdate) {
                if (!code) {
                    this.loading = false;
                    this.alert.error(this.translate.instant('i18n.rebuilderror'), {autoClose: true, delay: 3000});
                }
                let seq;
                outsubfield.textContent = code.split("/")[0]
                this.fetch_z311(code,this.form.value.lookupUrl).then((res: any) => {
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

                    seq = this.repair(res.seq,this.form.value.subfieldsize)

                    if (datafield995 && seq) {
                        const template = `<subfield code=${this.form.value.titleNumber}>${seq}</subfield>`;
                        let tempNode = document.createElementNS('', 'div');
                        tempNode.innerHTML = template;
                        let frag = tempNode.firstChild;
                        datafield995.appendChild(frag)
                    }

                    if (datafield995 && code && seq) {
                        let temp = `<subfield code=${this.form.value.callNo}>${code}/${seq}</subfield>`;
                        if(this.form.value.pubyear){
                            temp = `<subfield code=${this.form.value.callNo}>${code}/${seq}/${this.form.value.year}</subfield>`;
                        }
                        const template = temp
                        let tempNode = document.createElementNS("", 'div');
                        tempNode.innerHTML = template;
                        let frag = tempNode.firstChild;
                        datafield995.appendChild(frag)
                    }

                    this.sortlist(datafield995)

                    if (this.choosebt) {
                        doc.documentElement.appendChild(datafield995);
                    }
                    value.anies[0] = new XMLSerializer().serializeToString(doc.documentElement);

                    if (this.form.value.holding && this.form.value.classificationNumber && this.form.value.titleNumber && this.form.value.callNo) {
                        this.updateAnies(value.anies[0]);
                    } else {
                        this.loading = false;
                        this.alert.error(this.translate.instant('i18n.errortip'), {autoClose: true, delay: 3000});
                        this.setDefaultValue(this.form.value);
                    }

                })
            } else {
                if (this.choosebt) {
                    let seq;
                    outsubfield.textContent = code.split("/")[0]
                    if (!eoutsubfield || !ecode) {
                        this.fetch_z311(code,this.form.value.lookupUrl).then((res: any) => {
                            seq = this.repair(res.seq,this.form.value.subfieldsize)
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
                                    let temp = `<subfield code=${this.form.value.callNo}>${code}/${seq}</subfield>`;
                                    if(this.form.value.pubyear){
                                        temp = `<subfield code=${this.form.value.callNo}>${code}/${seq}/${this.form.value.year}</subfield>`;
                                    }
                                    const template = temp
                                    let tempNode = document.createElementNS("", 'div');
                                    tempNode.innerHTML = template;
                                    let frag = tempNode.firstChild;
                                    datafield995.appendChild(frag)
                                }
                            } else {
                                if (code && seq) {
                                    if(this.form.value.pubyear){
                                        soutsubfield.textContent = `${code}/${seq}/${this.form.value.year}`
                                    }else{
                                        soutsubfield.textContent = `${code}/${seq}`
                                    }
                                }
                            }
                            this.sortlist(datafield995)

                            value.anies[0] = new XMLSerializer().serializeToString(doc.documentElement);

                            if (this.form.value.holding && this.form.value.classificationNumber && this.form.value.titleNumber && this.form.value.callNo) {
                                this.updateAnies(value.anies[0]);
                            } else {
                                this.loading = false;
                                this.alert.error(this.translate.instant('i18n.errortip'), {autoClose: true, delay: 3000});
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
                            this.alert.error(this.translate.instant('i18n.errortip'), {autoClose: true, delay: 3000});
                            this.setDefaultValue(this.form.value);
                        }
                    }
                } else {
                    if (!code) {
                        this.loading = false;
                        this.alert.error(this.translate.instant('i18n.rebuilderror'), {autoClose: true, delay: 3000});
                    }
                    let seq;
                    outsubfield.textContent = code.split("/")[0]
                    this.fetch_z311(code,this.form.value.lookupUrl).then((res: any) => {
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

                        seq = this.repair(res.seq,this.form.value.subfieldsize)

                        // if(!eoutsubfield) {
                        if (datafield995 && seq) {
                            const template = `<subfield code=${this.form.value.titleNumber}>${seq}</subfield>`;
                            let tempNode = document.createElementNS('', 'div');
                            tempNode.innerHTML = template;
                            let frag = tempNode.firstChild;
                            datafield995.appendChild(frag)
                        }

                        if (datafield995 && code && seq) {
                            let temp = `<subfield code=${this.form.value.callNo}>${code}/${seq}</subfield>`;
                            if(this.form.value.pubyear){
                                temp = `<subfield code=${this.form.value.callNo}>${code}/${seq}/${this.form.value.year}</subfield>`;
                            }
                            const template = temp
                            let tempNode = document.createElementNS("", 'div');
                            tempNode.innerHTML = template;
                            let frag = tempNode.firstChild;
                            datafield995.appendChild(frag)
                        }

                        this.sortlist(datafield995)

                        if (!this.choosebt) {
                            doc.documentElement.appendChild(datafield995);
                        }
                        value.anies[0] = new XMLSerializer().serializeToString(doc.documentElement);

                        if (this.form.value.holding && this.form.value.classificationNumber && this.form.value.titleNumber && this.form.value.callNo) {
                            this.updateAnies(value.anies[0]);
                        } else {
                            this.loading = false;
                            this.alert.error(this.translate.instant('i18n.errortip'), {autoClose: true, delay: 3000});
                            this.setDefaultValue(this.form.value);
                        }

                    })
                }

            }
        }else{
            if (this.choosebt && !this.rebuildorupdate) {
                if (!code) {
                    this.loading = false;
                    this.alert.error(this.translate.instant('i18n.rebuilderror'), {autoClose: true, delay: 3000});
                }
                let seq;
                outsubfield.textContent = code.split("/")[0]
                this.fetch_z311(code,this.form21.value.lookupUrl).then((res: any) => {
                    datafield995.innerHTML = '';
                    if (this.form21.value.institution != '' && this.form21.value.institutionType != '') {
                        const template = `<subfield code=${this.form21.value.institutionType}>${this.form21.value.institution}</subfield>`;
                        let tempNode = document.createElementNS("", 'div');
                        tempNode.innerHTML = template;
                        let frag = tempNode.firstChild;
                        datafield995.appendChild(frag)
                    }

                    if (code) {
                        const template = `<subfield code=${this.form21.value.classificationNumber}>${code}</subfield>`;
                        let tempNode = document.createElementNS('', 'div');
                        tempNode.innerHTML = template;
                        let frag = tempNode.firstChild;
                        datafield995.appendChild(frag)
                    }

                    seq = this.repair(res.seq,this.form21.value.subfieldsize)

                    if (datafield995 && seq) {
                        const template = `<subfield code=${this.form21.value.titleNumber}>${seq}</subfield>`;
                        let tempNode = document.createElementNS('', 'div');
                        tempNode.innerHTML = template;
                        let frag = tempNode.firstChild;
                        datafield995.appendChild(frag)
                    }

                    if (datafield995 && code && seq) {
                        const template = `<subfield code=${this.form21.value.callNo}>${code}/${seq}</subfield>`;
                        let tempNode = document.createElementNS("", 'div');
                        tempNode.innerHTML = template;
                        let frag = tempNode.firstChild;
                        datafield995.appendChild(frag)
                    }

                    this.sortlist(datafield995)

                    if (this.choosebt) {
                        doc.documentElement.appendChild(datafield995);
                    }
                    value.anies[0] = new XMLSerializer().serializeToString(doc.documentElement);

                    if (this.form21.value.holding && this.form21.value.classificationNumber && this.form21.value.titleNumber && this.form21.value.callNo) {
                        this.updateAnies(value.anies[0]);
                    } else {
                        this.loading = false;
                        this.alert.error(this.translate.instant('i18n.errortip'), {autoClose: true, delay: 3000});
                        this.set21DefaultValue(this.form21.value);
                    }

                })
            } else {
                if (this.choosebt) {
                    let seq;
                    outsubfield.textContent = code.split("/")[0]
                    if (!eoutsubfield || !ecode) {
                        this.fetch_z311(code,this.form21.value.lookupUrl).then((res: any) => {
                            seq = this.repair(res.seq,this.form21.value.subfieldsize)
                            if (datafield995 && seq) {
                                const template = `<subfield code=${this.form21.value.titleNumber}>${seq}</subfield>`;
                                let tempNode = document.createElementNS('', 'div');
                                tempNode.innerHTML = template;
                                let frag = tempNode.firstChild;
                                datafield995.appendChild(frag)
                            }

                            // datafield995.removeChild(eoutsubfield)
                            // datafield995.removeChild(soutsubfield)

                            if (!soutsubfield) {
                                if (datafield995 && code && seq) {
                                    const template = `<subfield code=${this.form21.value.callNo}>${code}/${seq}</subfield>`;
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

                            value.anies[0] = new XMLSerializer().serializeToString(doc.documentElement);

                            if (this.form21.value.holding && this.form21.value.classificationNumber && this.form21.value.titleNumber && this.form21.value.callNo) {
                                this.updateAnies(value.anies[0]);
                            } else {
                                this.loading = false;
                                this.alert.error(this.translate.instant('i18n.errortip'), {autoClose: true, delay: 3000});
                                this.set21DefaultValue(this.form21.value);
                            }
                        })
                    } else {
                        eoutsubfield.textContent = `${ecode}`;

                        if (!soutsubfield) {
                            if (datafield995 && code && ecode) {
                                const template = `<subfield code=${this.form21.value.callNo}>${code}/${ecode}</subfield>`;
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

                        if (this.form21.value.holding && this.form21.value.classificationNumber && this.form21.value.titleNumber && this.form21.value.callNo) {
                            this.updateAnies(value.anies[0]);
                        } else {
                            this.loading = false;
                            this.alert.error(this.translate.instant('i18n.errortip'), {autoClose: true, delay: 3000});
                            this.set21DefaultValue(this.form21.value);
                        }
                    }
                } else {
                    if (!code) {
                        this.loading = false;
                        this.alert.error(this.translate.instant('i18n.rebuilderror'), {autoClose: true, delay: 3000});
                    }
                    let seq;
                    outsubfield.textContent = code.split("/")[0]
                    this.fetch_z311(code,this.form21.value.lookupUrl).then((res: any) => {
                        datafield995.innerHTML = '';
                        if (this.form21.value.institution != '' && this.form21.value.institutionType != '') {
                            const template = `<subfield code=${this.form21.value.institutionType}>${this.form21.value.institution}</subfield>`;
                            let tempNode = document.createElementNS("", 'div');
                            tempNode.innerHTML = template;
                            let frag = tempNode.firstChild;
                            datafield995.appendChild(frag)
                        }

                        if (code) {
                            const template = `<subfield code=${this.form21.value.classificationNumber}>${code}</subfield>`;
                            let tempNode = document.createElementNS('', 'div');
                            tempNode.innerHTML = template;
                            let frag = tempNode.firstChild;
                            datafield995.appendChild(frag)
                        }

                        seq = this.repair(res.seq,this.form21.value.subfieldsize)

                        // if(!eoutsubfield) {
                        if (datafield995 && seq) {
                            const template = `<subfield code=${this.form21.value.titleNumber}>${seq}</subfield>`;
                            let tempNode = document.createElementNS('', 'div');
                            tempNode.innerHTML = template;
                            let frag = tempNode.firstChild;
                            datafield995.appendChild(frag)
                        }

                        if (datafield995 && code && seq) {
                            const template = `<subfield code=${this.form21.value.callNo}>${code}/${seq}</subfield>`;
                            let tempNode = document.createElementNS("", 'div');
                            tempNode.innerHTML = template;
                            let frag = tempNode.firstChild;
                            datafield995.appendChild(frag)
                        }

                        this.sortlist(datafield995)

                        if (!this.choosebt) {
                            doc.documentElement.appendChild(datafield995);
                        }
                        value.anies[0] = new XMLSerializer().serializeToString(doc.documentElement);

                        if (this.form21.value.holding && this.form21.value.classificationNumber && this.form21.value.titleNumber && this.form21.value.callNo) {
                            this.updateAnies(value.anies[0]);
                        } else {
                            this.loading = false;
                            this.alert.error(this.translate.instant('i18n.errortip'), {autoClose: true, delay: 3000});
                            this.set21DefaultValue(this.form21.value);
                        }

                    })
                }

            }
        }

    }

    repair(value: any,size:any) { // complement by subfieldsize 0
        let i = 1;
        let zero = '0';
        if (value.toString().length < size) {
            while (i < size - value.toString().length) {
                zero = zero + '0';
                i++;
            }
            value = zero + value
        }
        return value;
    }

    sortlist(value: any) {  // sort
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
//https://api.exldevnetwork.net.cn  → 临时 https://dxcgj4rqx9.execute-api.cn-north-1.amazonaws.com.cn
    fetch_z311(key: string,lookupUrl:string) {
        return new Promise((resolve, reject) => {
            this.eventsService.getAuthToken().subscribe(
                data => {
                    this.http.get("https://api.exldevnetwork.net.cn" + lookupUrl.replace("KEY", key), {
                        headers: {
                            'X-Proxy-Host': 'http://n5cloud.library.nenu.edu.cn',
                            'Authorization': 'Bearer ' + data
                        }
                    }).subscribe(function (data) {
                        this.loading = false;
                        resolve(data)
                    }, error => {
                        this.loading = false;
                        this.alert.error(this.translate.instant('i18n.error', {url: "https://api.exldevnetwork.net.cn" + lookupUrl.replace("KEY", key)}), {autoClose: true, delay: 3000});
                        reject(error)
                    })
                }
            );

            // resolve({seq: Math.ceil(Math.random() * 99)})
        })

    }

    getcckb(key: string) {
        var json = {"apikey":"562930543E3E090957C595704CF28BE4"};
        return new Promise((resolve, reject) => {
            this.eventsService.getAuthToken().subscribe(
                data => {
                    this.http.post("https://api.exldevnetwork.net.cn" + "/cckbapi/almaBooklist", json,{
                        headers: {
                            'X-Proxy-Host': 'http://n5cloud.library.nenu.edu.cn',
                            'Authorization': 'Bearer ' + data
                        }
                    }).subscribe(function (data) {
                        // this.loading = false;
                        resolve(data)
                    }, error => {
                        // this.loading = false;
                        // this.alert.error(this.translate.instant('i18n.error', {url: "https://api.exldevnetwork.net.cn" + lookupUrl.replace("KEY", key)}), {autoClose: true, delay: 3000});
                        reject(error)
                    })
                }
            );

            // resolve({seq: Math.ceil(Math.random() * 99)})
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
                this.alert.error(this.translate.instant('i18n.errorupdate'), {autoClose: true, delay: 3000});
                // console.error(e);
                this.loading = false;
            }
        });
    }

    refreshPage = () => {
        this.loading = true;
        this.eventsService.refreshPage().subscribe({
            next: () => this.alert.success('Success!'),
            error: e => {
                this.alert.error(this.translate.instant('i18n.errorrefreshpage'), {autoClose: true, delay: 3000});
            },
            complete: () => this.loading = false
        });
    }

    // if form value is null,fill the default value
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
        if (settings.institutionType) {
            this.form.value.institutionType = settings.institutionType
        } else {
            this.form.value.institutionType = 'a'
        }
        if (settings.classification) {
            this.form.value.classification = settings.classification
        } else {
            this.form.value.classification = '690a'
        }
        if (settings.holding) {
            this.form.value.holding = settings.holding
        } else {
            this.form.value.holding = '905'
        }
        if (settings.lookupUrl) {
            this.form.value.lookupUrl = settings.lookupUrl
        } else {
            this.form.value.lookupUrl = '/proxy/cgi-bin/fetch_z311.cgi?uname=proquest&upass=L0china&key=KEY'
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
        if (settings.Publishedyear) {
            this.form.value.Publishedyear = settings.Publishedyear
        } else {
            this.form.value.Publishedyear = false
        }
        if (settings.year) {
            this.form.value.year = settings.year
        } else {
            this.form.value.year = ''
        }
        if (settings.pubyear) {
            this.form.value.pubyear = settings.pubyear
        } else {
            this.form.value.pubyear = false
        }
    }

    set21DefaultValue(settings: any) {
        if (settings.institution) {
            this.form21.value.institution = settings.institution
        } else {
            this.form21.value.institution = '211010'
        }
        if (settings.institutionType) {
            this.form21.value.institutionType = settings.institutionType
        } else {
            this.form21.value.institutionType = 'a'
        }
        if (settings.classification) {
            this.form21.value.classification = settings.classification
        } else {
            this.form21.value.classification = '093a'
        }
        if (settings.holding) {
            this.form21.value.holding = settings.holding
        } else {
            this.form21.value.holding = '905'
        }
        if (settings.lookupUrl) {
            this.form21.value.lookupUrl = settings.lookupUrl
        } else {
            this.form21.value.lookupUrl = '/proxy/cgi-bin/fetch_z311.cgi?uname=proquest&upass=L0china&key=KEY'
        }
        if (settings.lookupPrefix) {
            this.form21.value.lookupPrefix = settings.lookupPrefix
        } else {
            this.form21.value.lookupPrefix = ''
        }
        if (settings.classificationNumber) {
            this.form21.value.classificationNumber = settings.classificationNumber
        } else {
            this.form21.value.classificationNumber = 'a'
        }
        if (settings.titleNumber) {
            this.form21.value.titleNumber = settings.titleNumber
        } else {
            this.form21.value.titleNumber = 'b'
        }
        if (settings.callNo) {
            this.form21.value.callNo = settings.callNo
        } else {
            this.form21.value.callNo = 'u'
        }
        if (settings.subfieldsize) {
            this.form21.value.subfieldsize = settings.subfieldsize
        } else {
            this.form21.value.subfieldsize = '0'
        }
    }
}
