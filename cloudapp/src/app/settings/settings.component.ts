import {Subscription} from 'rxjs';
import {FormBuilder,FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
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
    selector: 'app-settings',
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.scss']
})
@NgModule({
    imports: [HttpClientModule, FormsModule]
})
export class SettingsComponent implements OnInit, OnDestroy {

    form: FormGroup;
    form21:FormGroup;

    private pageLoad$: Subscription;
    pageEntities: Entity[];
    private _apiResult: any;
    private name: String = '';
    hasApiResult: boolean = false;
    ifCNor21:boolean = false;
    show: boolean = false;
    loading = false;
    Publishedyear:boolean = false;
    year:String = '';
    models:any = {
        cnmarc:{
            institution:'',
            institutionType:'a',
            classification:'690a',
            holding: '905',
            lookupUrl: '/proxy/cgi-bin/fetch_z311.cgi?uname=proquest&upass=L0china&key=KEY',
            lookupPrefix:'',
            classificationNumber: 'd',
            titleNumber: 'e',
            callNo: 's',
            subfieldsize: '0',
            Publishedyear:false,
            year:'',
            pubyear:false
        },
        marc21:{
            institution:'',
            institutionType:'a',
            classification:'093a',
            holding: '905',
            lookupUrl: '/proxy/cgi-bin/fetch_z311.cgi?uname=proquest&upass=L0china&key=KEY',
            lookupPrefix:'',
            classificationNumber: 'd',
            titleNumber: 'u',
            callNo: 's',
            subfieldsize: '0',
        }
    }

    constructor(private restService: CloudAppRestService,
                private eventsService: CloudAppEventsService,
                private settingsService: CloudAppSettingsService,
                private translate: TranslateService,
                private http: HttpClient,
                private fb:FormBuilder,
                private alert: AlertService) {
    }

    ngOnInit() {
        this.pageLoad$ = this.eventsService.onPageLoad(this.onPageLoad);
        this.getSettings()
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
                    this.parseRes(this.apiResult)
                });
            }

        } else {
            this.apiResult = {};
        }
    }

    showConfig() {
        history.back()
    }
    chooseCN21(){
        this.ifCNor21 = !this.ifCNor21;
    }

    saved() {
        if(!this.ifCNor21){
            if (this.form.value.holding && this.form.value.classificationNumber && this.form.value.titleNumber && this.form.value.callNo) {
                this.setconfig();
                this.alert.success(this.translate.instant('i18n.savedate'));
            } else {
                this.alert.error(this.translate.instant('i18n.errortip'), {autoClose: true, delay: 3000});
                this.setDefaultValue(this.form.value);
            }
        }else{
            if (this.form21.value.holding && this.form21.value.classificationNumber && this.form21.value.titleNumber && this.form21.value.callNo) {
                this.setconfig();
                this.alert.success(this.translate.instant('i18n.savedate'));
            } else {
                this.alert.error(this.translate.instant('i18n.errortip'), {autoClose: true, delay: 3000});
                this.setDefaultValue(this.form21.value);
            }
        }
    }

    getSettings() {
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

        });
    }


    parseRes(value:any){
        //parse api for page
        let anies = value.anies[0]
        const doc = new DOMParser().parseFromString(anies, "application/xml");
        let field100='';
        // console.log(doc)
        //extract the data in field "ldr"
        let fieldldr = doc.getElementsByTagName("leader")[0].innerHTML
        // console.log(fieldldr.substring(7,8))

        //extract the data in field "100"
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
            this.Publishedyear = true;
        }
            this.year = field100.substring(9,13);
    }

    repair(value: any) { // complement by subfieldsize 0
        let i = 1;
        let zero = '0';
        if (value.toString().length < this.form.value.subfieldsize) {
            while (i < this.form.value.subfieldsize - value.toString().length) {
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

    fetch_z311(key: string) {
        return new Promise((resolve, reject) => {
            this.eventsService.getAuthToken().subscribe(
                data => {
                    this.http.get("https://api.exldevnetwork.net.cn" + this.form.value.lookupUrl.replace("KEY", key), {
                        headers: {
                            'X-Proxy-Host': 'http://n5cloud.library.nenu.edu.cn',
                            'Authorization': 'Bearer ' + data
                        }
                    }).subscribe(function (data) {
                        this.loading = false;
                        resolve(data)
                    }, error => {
                        this.loading = false;
                        this.alert.error(this.translate.instant('i18n.error', {url: "https://api.exldevnetwork.net.cn" + this.form.value.lookupUrl.replace("KEY", key)}), {autoClose: true, delay: 3000});
                        reject(error)
                    })
                }
            );

            // resolve({seq: Math.ceil(Math.random() * 99)})
        })

    }

    // if form value is null,fill the default value
    setDefaultValue(settings: any) {
        if(!this.ifCNor21){
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
        }else{
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

    setconfig(){
        this.show = !this.show;
        if(this.Publishedyear && this.form.value.Publishedyear){
            this.form.value.pubyear = true;
            this.form.value.year = this.year
        }else{
            this.form.value.pubyear = false;
            this.form.value.year = ''
        }
        this.models.cnmarc = this.form.value
        this.models.marc21 = this.form21.value
        this.settingsService.set(this.models).subscribe(response =>
                response => {
                    this.form.markAsPristine();
                },
            err => this.alert.error(err.message, {autoClose: true, delay: 3000}),
            // () => this.saving = false
        );
    }
}


