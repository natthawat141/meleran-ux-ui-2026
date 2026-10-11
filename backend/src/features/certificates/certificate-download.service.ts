import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { VerifiedSessionReference } from '../auth/public/index';
import { CertificateReadService } from './certificate-read.service';
import { CertificateDetailDto } from './dto/certificate-detail.dto';
export interface CertificateDownload {filename:string;content_type:'text/plain';content:string}
@Injectable() export class CertificateTextRenderer {
  render(snapshot:CertificateDetailDto):CertificateDownload{
    const singleLine=(s:string)=>s.replace(/[\u0000-\u001f\u007f]/g,' ');
    // No disk/network/public URL. The owner-proved immutable issuance is the only source.
    return {filename:'melearn-certificate-'+createHash('sha256').update(snapshot.id).digest('hex').slice(0,20)+'.txt',content_type:'text/plain',
      content:['ใบรับรองการเรียนจบคอร์ส','Melearn Tutor','',
        'ผู้เรียน: '+singleLine(snapshot.learner_name),'คอร์ส: '+singleLine(snapshot.course_title),
        'วันที่ออก: '+snapshot.issued_at,'รหัสใบรับรอง: '+singleLine(snapshot.code),''].join('\n')};
  }
}
@Injectable() export class CertificateDownloadService {
  constructor(private readonly certificates:CertificateReadService,private readonly renderer:CertificateTextRenderer){}
  async download(reference:VerifiedSessionReference,id:string):Promise<CertificateDownload>{
    // detail() holds fresh authority/owned Enrollment+Certificate locks through proof
    // projection. Rendering is deterministic after this read linearization point.
    const snapshot=await this.certificates.detail(reference,id);
    return this.renderer.render(snapshot);
  }
}
